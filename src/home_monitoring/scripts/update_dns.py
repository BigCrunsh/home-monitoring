#!/usr/bin/env python3
"""Update Dynu DNS entry."""
import asyncio
import sys

from home_monitoring.core.dns import DynuService
from home_monitoring.utils.logging import configure_logging


async def main() -> int:
    """Update the DNS entry.

    Returns:
        Exit code
    """
    configure_logging()
    service = DynuService()

    try:
        await service.update_dns()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
