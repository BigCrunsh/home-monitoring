PROJECT_NAME = home-monitoring
PYTHON = python3.12
SRC_DIR = src
TESTS_DIR = tests

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  clean        to remove python artifacts"
	@echo "  init         to install project for local development"
	@echo "  test         to run tests and check code quality"
	@echo "  test-unit    to run unit tests only"
	@echo "  test-integration to run integration tests only"
	@echo "  check-iobroker to parse the ioBroker scripts and test the vis_card helpers"
	@echo "  lint         to run code linting"
	@echo "  format       to format code with black"
	@echo "  type-check   to run type checking with mypy"
	@echo "  init-docker  to create docker storages"
	@echo "  start-docker to start monitoring containers"
	@echo "  stop-docker  to stop monitoring containers"
	@echo "  logs-docker  to show docker logs"

.PHONY: clean
clean:
	find . -name '*.pyc' -delete
	find . -name '__pycache__' -type d -exec rm -rf {} +
	find . -name '*.egg-info' -exec rm -rf {} +
	rm -rf .cache .config .ipython .jupyter .local .pytest_cache .ruff_cache .coverage
	rm -rf dist build

.PHONY: init
init:
	$(PYTHON) -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip
	. .venv/bin/activate && pip install -e ".[dev]"
	cp .env.example .env
	@echo "Project initialized. Activate the virtual environment with:"
	@echo "source .venv/bin/activate"

.PHONY: test
test: lint test-unit test-integration

.PHONY: test-unit
test-unit:
	$(PYTHON) -m pytest $(TESTS_DIR)/unit -v --cov=$(SRC_DIR)/home_monitoring

.PHONY: test-integration
test-integration:
	$(PYTHON) -m pytest $(TESTS_DIR)/integration -v

.PHONY: lint
lint: check type-check

# everything CI checks, in one command: run it before every commit
.PHONY: verify
verify: check type-check secrets
	PYTHONPATH=$(SRC_DIR) $(PYTHON) -m pytest $(TESTS_DIR) -m "not integration" -q

# read-only quality gate (CI-safe): never modifies files
.PHONY: check
check: ruff check-iobroker
	$(PYTHON) -m black --check $(SRC_DIR) $(TESTS_DIR)

# ioBroker dashboard scripts: they are deployed as script objects, not imported, so a syntax
# error only ever surfaces on the Pi. Parse every one, then unit-test the pure helpers in the
# vis_card global (thresholds and the Maxxisun sign convention) — the parts a typo can silently
# invert. Needs only node, which node --check already requires.
.PHONY: check-iobroker
check-iobroker:
	@for f in integrations/iobroker/*.js; do node --check "$$f" || exit 1; done
	node --test $(TESTS_DIR)/iobroker/*.test.js

# No credentials in the repo: scans every commit (the history is public once pushed).
# Uses an installed gitleaks, else the pinned container image. The container needs the main
# checkout mounted at its own path, so a worktree's .git pointer resolves inside it.
GITLEAKS_IMAGE = ghcr.io/gitleaks/gitleaks:v8.21.2
.PHONY: secrets
secrets:
	@if command -v gitleaks >/dev/null; then gitleaks git . --redact --no-banner; \
	else root="$$(cd "$$(git rev-parse --git-common-dir)/.." && pwd)"; \
	docker run --rm -v "$$root:$$root:ro" $(GITLEAKS_IMAGE) git "$$PWD" --redact --no-banner; fi

# Deploy to the Pi from the workstation. Both refuse when the live copy was edited on the Pi
# (it matches no committed version) or the local file has uncommitted changes.
# Add DRY_RUN=1 to only run the drift check.
.PHONY: deploy-script
deploy-script:
	@test -n "$(NAME)" || { echo "usage: make deploy-script NAME=<script>"; exit 1; }
	PYTHONPATH=$(SRC_DIR) $(PYTHON) -m home_monitoring.scripts.deploy_iobroker script $(NAME) $(if $(DRY_RUN),--dry-run)

.PHONY: deploy-vis
deploy-vis:
	PYTHONPATH=$(SRC_DIR) $(PYTHON) -m home_monitoring.scripts.deploy_iobroker vis $(if $(DRY_RUN),--dry-run)

.PHONY: format
format:
	$(PYTHON) -m black $(SRC_DIR) $(TESTS_DIR)

.PHONY: type-check
type-check:
	$(PYTHON) -m mypy $(SRC_DIR)

.PHONY: ruff
ruff:
	$(PYTHON) -m ruff check $(SRC_DIR) $(TESTS_DIR)

.PHONY: init-docker
init-docker:
	docker volume create influxdb-storage

.PHONY: start-docker
start-docker:
	docker start influxdb || docker run -d \
		--restart unless-stopped \
		-p 8086:8086 \
		--name=influxdb \
		--volume influxdb-storage:/var/lib/influxdb/ \
		influxdb:1.8

.PHONY: stop-docker
stop-docker:
	docker stop influxdb || true

.PHONY: logs-docker
logs-docker:
	docker logs -f influxdb

.PHONY: scripts-exec
scripts-exec:
	chmod +x scripts/*.py
