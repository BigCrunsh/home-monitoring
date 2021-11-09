#! /usr/bin/env python3

"""Collect photovoltaic and energy data and ingest in Influx DB."""

import os
import argparse
import sys

import datetime

from homemonitoring.util import LoggerConfig
from homemonitoring.influxdb import InfluxDBClient


def run(args):
    """Crawl Covid numbers and ingest into influxDB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    response = requests.get('https://pomber.github.io/covid19/timeseries.json').json()

    points = [
        {
            "measurement": 'covid_cases_count',
            "time": datetime.datetime.strptime(r['date'], '%Y-%m-%d'),
            "fields": {'confirmed': r['confirmed']},
            "tags": {
                "country": 'Germany'.lower(),
            }
        }
        for r in response['Germany']
    ]

    ifclient.write_points(points)


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl pomber.github.io API and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
