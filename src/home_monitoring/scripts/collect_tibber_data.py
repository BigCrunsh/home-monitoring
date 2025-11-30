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

    include_price = not args.consumption_only
    include_summaries = not args.prices_only

    # If both flags are set, nothing to do but keep behaviour explicit
    if not include_price and not include_summaries:
        logger.warning("no_tibber_data_selected")
        return 0

    try:
        await service.collect_and_store(
            include_price=include_price,
            include_summaries=include_summaries,
        )

        # Preserve high-level log signals for callers
        if include_price:
            logger.info("tibber_price_data_collected")
        if include_summaries:
            logger.info("tibber_consumption_data_collected")

        return 0
    except Exception as e:
        logger.error(
            "tibber_collection_failed",
            error=str(e),
            include_price=include_price,
            include_summaries=include_summaries,
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
