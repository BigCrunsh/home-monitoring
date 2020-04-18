#! /usr/bin/env python3

"""Collect weather station data and ingest in Influx DB."""

import os
import argparse
import sys
import datetime

from influxdb import InfluxDBClient
import netatmo

from homemonitoring.response_mappers import NetatmoResponseMapper
from homemonitoring.util import LoggerConfig


def run(args):
    """Query Netatmo API to collect weather data and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )
    api = netatmo.WeatherStation({
        'client_id': args.netatmo_client_id,
        'client_secret': args.netatmo_client_secret,
        'username': args.netatmo_user,
        'password': args.netatmo_password
    })

    logger.info('Get station data')
    assert api.get_data()
    time = datetime.datetime.utcnow()
    response = api.devices

    points = NetatmoResponseMapper.to_influxdb_point(response, time)
    try:
        ifclient.write_points(points)
    except Exception as e:
        logger.error(points)
        logger.error(e)
        exit(1)

    logger.info('Done')


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl Netatmo API and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--netatmo-user', required=False, default=os.getenv('NETATMO_USERNAME'), help="Netatmo user name")  # noqa
    parser.add_argument('--netatmo-password', required=False, default=os.getenv('NETATMO_PASSWORD'), help="Netatmo password")  # noqa
    parser.add_argument('--netatmo-client-id', required=False, default=os.getenv('NETATMO_CLIENT_ID'), help="Netatmo client id")  # noqa
    parser.add_argument('--netatmo-client-secret', required=False, default=os.getenv('NETATMO_CLIENT_SECRET'), help="Netatmo client secret")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, type=int, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
