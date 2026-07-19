#!/usr/bin/env python3
"""Collect data from Netatmo weather station."""

import asyncio
import sys

from home_monitoring.services.netatmo import NetatmoService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main() -> int:
    """Run the data collection.

    Returns:
        Exit code
    """
    configure_logging()
    service = NetatmoService()

    try:
        await service.collect_and_store()
    except Exception as e:
        logger.error("netatmo_collection_failed", error=str(e))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
