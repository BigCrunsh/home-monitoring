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
    service = TibberService(user_agent=args.user_agent)

    exit_code = 0

    # Collect current price data
    if not args.consumption_only:
        try:
            await service.collect_and_store()
            logger.info("tibber_price_data_collected")
        except Exception as e:
            logger.error("tibber_price_collection_failed", error=str(e))
            print(f"Error collecting price data: {e}", file=sys.stderr)
            exit_code = 1

    # Collect consumption and cost data
    if not args.prices_only:
        try:
            await service.collect_and_store_consumption_data()
            logger.info("tibber_consumption_data_collected")
        except Exception as e:
            logger.error("tibber_consumption_collection_failed", error=str(e))
            print(f"Error collecting consumption data: {e}", file=sys.stderr)
            exit_code = 1

    return exit_code


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
    parser.add_argument(
        "--prices-only",
        action="store_true",
        help="Collect only current price data",
    )
    parser.add_argument(
        "--consumption-only",
        action="store_true",
        help="Collect only consumption and cost data",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
