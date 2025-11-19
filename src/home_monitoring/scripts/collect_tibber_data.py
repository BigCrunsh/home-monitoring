#!/usr/bin/env python3
"""Collect data from Tibber API."""
import argparse
import asyncio
import sys

from home_monitoring.services.tibber import TibberService
from home_monitoring.utils.logging import configure_logging


async def main(args: argparse.Namespace) -> int:
    """Main entry point.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging()
    service = TibberService(user_agent=args.user_agent)

    try:
        await service.collect_and_store()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Collect electricity data from Tibber API",
    )
    parser.add_argument(
        "--user-agent",
        default="Sawade Homemonitoring",
        help="User agent string for API requests",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
