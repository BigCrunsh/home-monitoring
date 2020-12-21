#! /usr/bin/env python3

"""Update DynDNS entry."""

import os
import requests
import argparse
import sys


def run(args):
    """Update DynDNS at dnsexit.com entry via https request."""
    r = requests.get(
        'https://update.dnsexit.com/RemoteUpdate.sv',
        params={
            'host': args.dnsexit_host,
            'login': args.dnsexit_login,
            'password': args.dnsexit_password,
        }
    )
    r.raise_for_status()


def cfg():
    """Configuration of argument parser."""
    parser = argparse.ArgumentParser(
        description="Update DynDNS at dnsexit.com",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--dnsexit-host', required=False, default=os.getenv('DNSEXIT_HOST'), help="Host to update IP")  # noqa
    parser.add_argument('--dnsexit-login', required=False, default=os.getenv('DNSEXIT_LOGIN'), help="dnsexit login.")  # noqa
    parser.add_argument('--dnsexit-password', required=False, default=os.getenv('DNSEXIT_PASSWORD'), help="dnsexit password")  # noqa
    parser.add_argument('-v', '--verbose', action='store_true')
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(cfg()))
