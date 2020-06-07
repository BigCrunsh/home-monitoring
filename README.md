[![Build Status](https://travis-ci.com/BigCrunsh/home-monitoring.svg?branch=master)](https://travis-ci.com/BigCrunsh/home-monitoring)

![Example Dashboard](static/grafana.png)

# Home Monitoring
Different smart home application typically come with their own interfaces. As a user I want to have a central place to monitor the central metrics recorded by the different systems.

The project consolidates different scripts and configuration to collect home
montitoring metrics on a Raspberry PI 4; we use an influxDB to store and grafana to visualize the measurements.

Systems to Monitor:
- [Netatmo](https://www.netatmo.com/en-eu) is a smart home weather station.
- [SolarEdge](https://www.solaredge.com/) is a solar
	inverter and monitoring systems for photovoltaic arrays
- [Tankerkoenig](https://creativecommons.tankerkoenig.de/) provides gas station prices



## References
- [Monitoring your home network with InfluxDB on Raspberry Pi with Docker](https://mostlyoperational.com/posts/2017-12-28_monitoring-your-home-network-with-influxdb-on-raspberry-pi-with-docker/)
- [Docker Image with InfluxDB and Grafana](https://hub.docker.com/r/philhawthorne/docker-influxdb-grafana/)
