#!/usr/bin/env python3
"""Collect data from Tankerkoenig API."""

import argparse
import asyncio
import sys

from home_monitoring.services.tankerkoenig import TankerkoenigService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main(args: argparse.Namespace) -> int:
    """Run the data collection.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging(verbose=args.verbose)
    service = TankerkoenigService(cache_dir=args.cache_dir)

    try:
        await service.collect_and_store(force_update=args.force_update)
    except Exception as e:
        logger.error("tankerkoenig_collection_failed", error=str(e))
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Collect gas station prices from Tankerkoenig API",
    )
    parser.add_argument(
        "--cache-dir",
        help="Directory to cache station details",
    )
    parser.add_argument(
        "--force-update",
        action="store_true",
        help="Force update of station details from API",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
