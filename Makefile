PROJECT_NAME = homemonitoring

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  clean                  to remove python artifacts"
	@echo "  init                   to install project for local development"
	@echo "  test                   to check the code syle and run unit tests"
	@echo "  init-docker            to create docker storages"
	@echo "  start-docker           to start container"


.PHONY: clean
clean:
	find . -name '*.pyc' -delete
	rm -rf .cache .config .ipython .jupyter .local
	rm -rf $(PROJECT_NAME).egg-info

.PHONY: init
init:
	pip3 install -r requirements.txt

.PHONY: test
test:
	flake8 $(PROJECT_NAME) --config=$(PROJECT_NAME)/tox.ini
	pytest $(PROJECT_NAME)


.PHONY: init-docker
init-docker:
	docker volume create influxdb-storage
	docker volume create grafana-storage

.PHONY: start-docker
start-docker:
	docker run -d --name=influxdb --net=host --restart=always -v influxdb-storage:/data hypriot/rpi-influxdb
	docker run -d --name=grafana --net=host -v grafana-storage:/var/lib/grafana grafana/grafana
	docker run -d --name telegraf --net=host -v conf/telegraf.conf:/etc/telegraf/telegraf.conf:ro telegraf
