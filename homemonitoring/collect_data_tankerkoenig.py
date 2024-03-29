#! /usr/bin/env python3

"""Collect gas statio prices and ingest in Influx DB."""

import os
import argparse
import sys
import datetime
from influxdb import InfluxDBClient

from homemonitoring.tankerkoenig import TankerKoenig
from homemonitoring.response_mappers import TankerKoenigResponseMapper
from homemonitoring.util import LoggerConfig


DEFAULT_STATION_IDS = [
    # Berlin - Lichtenberg
    "51d4b477-a095-1aa0-e100-80009459e03a",
    "005056ba-7cb6-1ed2-bceb-8e5fec1a0d35",
    # Hamburg
    "f0a4e043-ba25-49a2-b40e-3bd50cd2074c",
    "e78510fb-5292-4c50-837f-f55a17a4111a",
    "f820f0a1-7a9c-4d99-91fc-4b09514f4820",
    "92b37d44-73f5-417a-a838-e3c8ca480433",
    "005056ba-7cb6-1ed2-bceb-6e6ee17d4d20",
    "83c9acef-23a8-4eeb-924e-fb303bc93c5e",
    "51d4b4dc-a095-1aa0-e100-80009459e03a",
    # St.Peter
    "eea4cf7e-ae3e-4865-bc3b-1cbebd121061",
    "196d6a02-b44f-435e-b49c-a6eab994e8d9",
    # Angermuende
    "4393bf57-f3de-42e6-8d4d-9d6ca6a9a526",
]


def run(args):
    """Query Tanker Koenig API to retrieve gas station prices and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )
    handler = TankerKoenig(api_key=args.api_key, cache_dir=args.cache_dir)

    time = datetime.datetime.utcnow()
    response_prices = handler.get_prices(DEFAULT_STATION_IDS)
    response_stations = handler.get_stations_details(DEFAULT_STATION_IDS, args.force_update)
    prices = TankerKoenigResponseMapper.to_influxdb_point(time, response_prices, response_stations)

    ifclient.write_points(prices)
    logger.info('done')


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Crawl TankerKoenig API and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--api-key', required=False, default=os.getenv('TANKERKOENIG_API_KEY'), help="API Key (request from TankerKoenig)")  # noqa
    parser.add_argument('--cache-dir', required=False, default=None, help="Caching directory to store station details and avoid API calls")  # noqa
    parser.add_argument('--force-update', action='store_true', help="Update and override station details even if already exist (be mindful about the rate limit)")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, type=int, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
