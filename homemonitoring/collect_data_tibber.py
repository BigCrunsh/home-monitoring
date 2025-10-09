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
    """Get Current Price Info from Tibber API."""
    tibber_connection = tibber.Tibber(token, user_agent=user_agent)
    await tibber_connection.update_info()
    print(tibber_connection.name)

    home = tibber_connection.get_homes()[0]
    await home.fetch_consumption_data()
    await home.update_info()
    print(home.address1)

    await tibber_connection.close_connection()
    return home.current_price_data


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
    response_prices = asyncio.run(
        get_tibber_prices(token=args.api_token, user_agent=args.user_agent)
    )
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
    parser.add_argument('--api-token', required=False, default=os.getenv('TIBBER_ACCESS_TOKEN'), help="Tibber access token")  # noqa
    parser.add_argument('--user-agent', required=False, default="Sawade Homemonitoring", help="User agent string submitted to tibber")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
