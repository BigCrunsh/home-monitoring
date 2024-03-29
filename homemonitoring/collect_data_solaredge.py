#! /usr/bin/env python3

"""Collect photovoltaic and energy data and ingest in Influx DB."""

import os
import argparse
import sys

from homemonitoring.solaredge import Solaredge
from homemonitoring.response_mappers import SolarEdgeResponseMapper
from homemonitoring.util import LoggerConfig
from homemonitoring.influxdb import InfluxDBClient


def run(args):
    """Query Solaredge API to collect photovoltaic and energy data and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    api = Solaredge(args.api_key)
    meta = api.get_meta()
    logger.info(meta)

    measurements = [
        (api.get_power_details, 'electricity_power_watt'),
        (api.get_energy_details, 'electricity_energy_watthour'),
    ]

    for get, measurement_name in measurements:
        logger.info(f'{measurement_name}')
        responses = get(start_time=ifclient.get_latest_timestamp(measurement_name))
        points = SolarEdgeResponseMapper.to_influxdb_point(
            responses, meta['location']['timeZone'], measurement_name
        )
        logger.info(f'data points added: {len(points)}')
        ifclient.write_points(points)


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl SolarEdge and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # TODO: error message when missing env variable
    parser.add_argument('--api-key', required=False, default=os.getenv('SOLAREDGE_API_KEY'), help="API Key (request from SolarEdge)")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
