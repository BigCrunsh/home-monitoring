#!/usr/bin/env python3
"""Script to collect data from SolarEdge API."""
import asyncio
import sys

from home_monitoring.services.solaredge import SolarEdgeService
from home_monitoring.utils.logging import configure_logging


async def main() -> int:
    """Main entry point.

    Returns:
        Exit code
    """
    configure_logging()
    service = SolarEdgeService()

    try:
        await service.collect_and_store()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
