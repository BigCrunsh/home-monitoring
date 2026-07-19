#!/usr/bin/env python3
"""Check measurement freshness in InfluxDB and alert via Telegram.

Runs one pass: every measurement's newest data point is compared against its
freshness SLA (conf/healthcheck.json); stale measurements alert once per
24h, recoveries notify once. Intended to run hourly from cron.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from home_monitoring.services.healthcheck import (
    AlertStore,
    FreshnessConfig,
    HealthcheckService,
)
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)

DEFAULT_CONFIG = Path(__file__).resolve().parents[3] / "conf" / "healthcheck.json"
DEFAULT_STATE = (
    Path.home() / ".local" / "state" / "home_monitoring" / "healthcheck.json"
)


async def main(args: argparse.Namespace) -> int:
    """Run the healthcheck.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging()
    try:
        config = FreshnessConfig.load(Path(args.config))
        store = AlertStore(Path(args.state_file))
        service = HealthcheckService(config=config, store=store)
        sent = await service.run()
        logger.info("healthcheck_done", notifications_sent=sent)
        return 0
    except Exception as e:
        logger.error("healthcheck_script_failed", error=str(e))
        return 1


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Check InfluxDB measurement freshness and alert via Telegram",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help=f"Path to the SLA configuration JSON (default: {DEFAULT_CONFIG})",
    )
    parser.add_argument(
        "--state-file",
        default=str(DEFAULT_STATE),
        help=f"Path to the alert state file (default: {DEFAULT_STATE})",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
