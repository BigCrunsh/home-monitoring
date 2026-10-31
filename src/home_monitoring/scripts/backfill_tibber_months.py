#!/usr/bin/env python3
"""Backfill Tibber's monthly cost/consumption history into InfluxDB (one-off).

Writes every completed month as a last_month point at 00:00 UTC on the first day
of the following month, so the Energie tab can compare a month with the same
month a year earlier. Run with --dry-run first to see what would be written.
"""

import argparse
import asyncio
import sys

from home_monitoring.services.tibber import TibberService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main(args: argparse.Namespace) -> int:
    """Run the backfill.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging()
    service = TibberService()
    try:
        measurements = await service.backfill_month_history(
            months=args.months, dry_run=args.dry_run
        )
    except Exception as e:
        logger.error("tibber_backfill_failed", error=str(e))
        return 1
    for m in measurements:
        if m.measurement == "electricity_costs_euro":
            print(f"{m.timestamp:%Y-%m-%d}  {m.fields['cost']:8.2f} €")
    print(("would write" if args.dry_run else "wrote") + f" {len(measurements)} points")
    return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Backfill Tibber monthly history into InfluxDB"
    )
    parser.add_argument(
        "--months", type=int, default=36, help="Months of history to request"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="List the months without writing"
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
