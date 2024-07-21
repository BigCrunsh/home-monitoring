#! /usr/bin/env python3

"""Collect electricity price and consumption and ingest in Influx DB."""

import os
import argparse
import sys
import asyncio

import tibber

from homemonitoring.response_mappers import TibberResponseMapper
from homemonitoring.util import LoggerConfig
from homemonitoring.influxdb import InfluxDBClient


async def get_tibber_prices(token, user_agent):
    tibber_connection = tibber.Tibber(token, user_agent=user_agent)
    await tibber_connection.update_info()
    home = tibber_connection.get_homes()[0]
    await home.update_info()
    await home.update_price_info()
    await tibber_connection.close_connection()
    return home.current_price_info


def run(args):
    """Queries Tibber API to collect electricity pice and consumption and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    logger.info("Query Tibber API")
    response_prices = asyncio.run(get_tibber_prices(args.api_token, cache_dir=args.user_agent))

    prices = TibberResponseMapper.to_influxdb_point(response_prices)
    ifclient.write_points(prices)
    logger.info('done')


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl SolarEdge and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # TODO: error message when missing env variable
    parser.add_argument('--gardena-email', required=False, default=os.getenv('GARDENA_EMAIL'), help="Gardena email")  # noqa
    parser.add_argument('--gardena-password', required=False, default=os.getenv('GARDENA_PASSWORD'), help="Gardena password")  # noqa
    parser.add_argument('--gardena-application-id', required=False, default=os.getenv('GARDENA_APPLICATION_ID'), help="Gardena application id")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
