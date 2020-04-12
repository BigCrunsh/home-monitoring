#! /usr/bin/env python3

import os
import argparse
import sys

import solaredge
from influxdb import InfluxDBClient

from homemonitoring.response_mappers import SolarEdgeResponseMapper
from homemonitoring.util import get_latest_timestamp_influxdb, get_date_ranges, LoggerConfig


def run(args):
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    api = solaredge.Solaredge(args.api_key)
    meta = api.get_list()['sites']['site'][0]
    logger.info(meta)

    measurement_name = 'electricity_power_watt'
    logger.info(f'{measurement_name}')
    start_dates, end_dates = get_date_ranges(
        meta['location']['timeZone'],
        get_latest_timestamp_influxdb(measurement_name, ifclient, meta['installationDate']),
    )
    logger.info(f'collect data for {start_dates[0]}-{end_dates[-1]}')
    num_points = 0
    for s, e in zip(start_dates, end_dates):
        response = api.get_power_details(
            site_id=meta['id'], start_time=s, end_time=e
        )
        points = SolarEdgeResponseMapper.to_influxdb_point(
            response, meta['location']['timeZone'], measurement_name
        )
        ifclient.write_points(points)
        num_points += len(points)
    logger.info(f'data points added: {num_points}')

    measurement_name = 'electricity_energy_watthour'
    logger.info(f'{measurement_name}')
    start_dates, end_dates = get_date_ranges(
        meta['location']['timeZone'],
        get_latest_timestamp_influxdb(measurement_name, ifclient, meta['installationDate']),
    )
    logger.info(f'collect data for {start_dates[0]}-{end_dates[-1]}')
    num_points = 0
    for s, e in zip(start_dates, end_dates):
        response = api.get_energy_details(
            site_id=meta['id'], start_time=s, end_time=e,
            time_unit='QUARTER_OF_AN_HOUR'
        )
        points = SolarEdgeResponseMapper.to_influxdb_point(
            response, meta['location']['timeZone'], measurement_name
        )
        ifclient.write_points(points)
        num_points += len(points)
    logger.info(f'data points added: {num_points}')


def cfg():
    parser = argparse.ArgumentParser(
        description="Crawl SolarEdge and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # TODO: error message when missing env variable
    parser.add_argument('--api-key', required=False, default=os.getenv('SOLAREDGE_API_KEY'), help="API Key (request from SolarEdge)")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_PORT'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
