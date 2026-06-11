#!/usr/bin/env python3
"""Collect reader data from Sam Digital API."""

import asyncio
import sys

from home_monitoring.services.sam_digital import SamDigitalService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main() -> int:
    """Run the data collection.

    Returns:
        Exit code.
    """
    configure_logging()
    service = SamDigitalService()

    try:
        await service.collect_and_store()
    except Exception as exc:  # pragma: no cover - script entry
        logger.error("sam_digital_collection_failed", error=str(exc))
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover - script entry
    sys.exit(asyncio.run(main()))
