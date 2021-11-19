#! /usr/bin/env python3

"""Update DynDNS entry."""

import os
import requests
import argparse
import sys

from homemonitoring.util import LoggerConfig


def run(args):
    """Update DynDNS at dynu.com entry via https request."""
    LoggerConfig.set_verbose(args.verbose)
    logger = LoggerConfig.get_logger(__name__)

    r = requests.get(
        'http://api.dynu.com/nic/update',
        params={
            'host': args.dynu_host,
            'username': args.dynu_username,
            'password': args.dynu_password,
        }
    )
    logger.info(r.text)
    r.raise_for_status()


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Update DynDNS at dynu.com",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--dynu-host', required=False, default=os.getenv('DYNU_HOST'), help="Host to update IP")  # noqa
    parser.add_argument('--dynu-username', required=False, default=os.getenv('DYNU_USERNAME'), help="Dynu username.")  # noqa
    parser.add_argument('--dynu-password', required=False, default=os.getenv('DYNU_PASSWORD'), help="Dynu password")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
