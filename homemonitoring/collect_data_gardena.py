#! /usr/bin/env python3

"""Collect smart gardening information and ingest in Influx DB."""

import os
import argparse
import sys
import datetime

from gardena import smart_system as gardena_smart_system

from homemonitoring.response_mappers import GardenaResponseMapper
from homemonitoring.util import LoggerConfig
from homemonitoring.influxdb import InfluxDBClient


def ingest_data(device, ifclient, logger):
    """Writes device attributes to influx db."""
    time = datetime.datetime.utcnow()
    if device.type == 'SMART_IRRIGATION_CONTROL':
        points = GardenaResponseMapper.control_data_to_influxdb_point(device, time)
    elif device.type == 'SENSOR':
        points = GardenaResponseMapper.sensor_data_to_influxdb_point(device, time)
    elif device.type == 'SOIL_SENSOR':
        points = GardenaResponseMapper.soil_sensor_data_to_influxdb_point(device, time)
    else:
        logger.warning(f"Device type {device.type} not implemented")
        return
    logger.debug(f"Data points to ingest {points}")
    ifclient.write_points(points)


def run(args):
    """Queries Gardena API to collect garden data and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    smart_system = gardena_smart_system.SmartSystem(
        client_id=args.gardena_application_id,
        client_secret=args.gardena_application_secret
    )
    logger.info("Start web socket")
    smart_system.authenticate()
    smart_system.update_locations()
    assert len(smart_system.locations) == 1, "Number of locations found is not 1"
    smart_system.location = list(smart_system.locations.values())[0]
    smart_system.update_devices(smart_system.location)
    smart_system.start_ws(smart_system.location)

    logger.info("Devices found:")
    for k, v in smart_system.location.devices.items():
        logger.info(f"- {k}: {v.name} ({v.type})")

    for t in ['SENSOR', 'SMART_IRRIGATION_CONTROL', 'SOIL_SENSOR']:
        for d in smart_system.location.find_device_by_type(t):
            d.add_callback(lambda d: ingest_data(d, ifclient, logger))

    input("Press any key to quit: ")

    logger.info("Quit web socket")
    smart_system.quit()


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl SolarEdge and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # TODO: error message when missing env variable
    parser.add_argument('--gardena-application-id', required=False, default=os.getenv('GARDENA_APPLICATION_ID'), help="Gardena application id")  # noqa
    parser.add_argument('--gardena-application-secret', required=False, default=os.getenv('GARDENA_APPLICATION_SECRET'), help="Gardena application secret")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
