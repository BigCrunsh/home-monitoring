#!/usr/bin/env python3
"""Collect data from Tibber API.

This script collects:
- Current electricity prices
- Consumption and cost data for last hour, yesterday, and last 24h
"""
import argparse
import asyncio
import sys

from home_monitoring.services.tibber import TibberService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main(args: argparse.Namespace) -> int:
    """Run the data collection.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging()
    # Only pass user_agent if provided, otherwise use service default
    kwargs = {}
    if args.user_agent:
        kwargs["user_agent"] = args.user_agent
    service = TibberService(**kwargs)

    try:
        await service.collect_and_store()

        logger.info("tibber_data_collected")

        return 0
    except Exception as e:
        logger.error(
            "tibber_collection_failed",
            error=str(e),
        )
        print(f"Error collecting Tibber data: {e}", file=sys.stderr)
        return 1


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
        help="User agent string for API requests",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
