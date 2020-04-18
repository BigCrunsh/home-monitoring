#! /usr/bin/env python3

import os
import argparse
import sys
import datetime
from influxdb import InfluxDBClient

from homemonitoring.handlers import TankerKoenigHandler
from homemonitoring.response_mappers import TankerKoenigResponseMapper
from homemonitoring.util import LoggerConfig


DEFAULT_STATION_IDS = {
    "51d4b477-a095-1aa0-e100-80009459e03a": "Jet",
    "005056ba-7cb6-1ed2-bceb-8e5fec1a0d35": "Star"
}

def run(args):
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )
    handler = TankerKoenigHandler(api_key=args.api_key)

    time = datetime.datetime.utcnow()
    response = handler.get_prices(DEFAULT_STATION_IDS.keys())
    prices = TankerKoenigResponseMapper.to_influxdb_point(time, response, DEFAULT_STATION_IDS)

    ifclient.write_points(prices)
    logger.info('done')


def cfg():
    parser = argparse.ArgumentParser(
        description="Crawl TankerKoenig API and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--api-key', required=False, default=os.getenv('TANKERKOENIG_API_KEY'), help="API Key (request from TankerKoenig)")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, type=int, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
