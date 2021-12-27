#! /usr/bin/env python3

"""Collect energy meter data and ingest in Influx DB."""

import os
import argparse
import sys
import datetime
import time
import serial

from influxdb import InfluxDBClient

from homemonitoring.response_mappers import TechemResponseMapper
from homemonitoring.util import LoggerConfig


def run(args):
    """Listen to serial port and ingest in influx DB."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    ifclient = InfluxDBClient(
        args.influxdb_host, args.influxdb_port,
        args.influxdb_user, args.influxdb_pass,
        args.influxdb_db
    )

    now = datetime.datetime.utcnow()
    ser = serial.Serial(args.serial_port, args.serial_baudrate, timeout=args.serial_timeout)
    time.sleep(2)
    logger.info('Listen to port %s', args.serial_port)
    assert ser.is_open, "Port not open"

    ser.write(b'V\r\n')
    version = ser.readline().rstrip().decode('utf-8')
    logger.info(f'Version: {version}')

    ser.write(b'brt\r\n')
    mode = ser.readline().rstrip().decode('utf-8')
    logger.info(f'Set WMBUS: {mode}')

    responses = set()
    for _ in range(args.serial_num_packets):
        r = ser.readline()
        logger.info(f'- {r}')
        responses.add(r)
    logger.info(f'Received {len(responses)} distinct messages.')
    ser.close()

    points = TechemResponseMapper.to_influxdb_point(now, responses)
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
        description="Receive Techem data via a serial port and stores results in InfluxDB",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--serial-port', required=False, default='/dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0', help="Serial port listen to receive heat meter data")  # noqa
    parser.add_argument('--serial-baudrate', required=False, type=int, default=38400, help="Baudrate of serial port")  # noqa
    parser.add_argument('--serial-num-packets', required=False, type=int, default=5, help="Number of data packets; should be larger than number of receivable IDs")  # noqa
    parser.add_argument('--serial-timeout', required=False, type=int, default=300, help="Timeout waiting for the serial port in seconds")  # noqa
    parser.add_argument('--influxdb-host', required=False, default=os.getenv('INFLUXDB_HOST'), help="influx db host")  # noqa
    parser.add_argument('--influxdb-port', required=False, type=int, default=os.getenv('INFLUXDB_PORT'), help="influx db port")  # noqa
    parser.add_argument('--influxdb-user', required=False, default=os.getenv('INFLUXDB_USER'), help="influx db user")  # noqa
    parser.add_argument('--influxdb-pass', required=False, default=os.getenv('INFLUXDB_PASS'), help="influx db password")  # noqa
    parser.add_argument('--influxdb-db', required=False, default=os.getenv('INFLUXDB_DB'), help="influx db database")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
