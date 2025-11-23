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
lint: format type-check ruff

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
