#!/usr/bin/env python3
"""Write 15-minute energy (electricity_energy_watthour) from local meters.

The SolarEdge cloud API this used to call was retired on 2026-11-03. Production now
comes from the inverter's lifetime counter (Modbus, logged by ioBroker), the grid
exchange from the Shelly 3EM's phase-netted records. The script keeps its name so the
cron entry stays valid.
"""

import asyncio
import sys
from datetime import UTC, datetime

import httpx
from home_monitoring.services.energy_totals.service import EnergyTotalsService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)
SHELLY_TIMEOUT_SECONDS = 30


async def main() -> int:
    """Run the energy computation.

    Returns:
        Exit code
    """
    configure_logging()
    try:
        async with httpx.AsyncClient(timeout=SHELLY_TIMEOUT_SECONDS) as http:
            await EnergyTotalsService(http=http).collect(now=datetime.now(UTC))
    except Exception as e:
        logger.error("energy_totals_failed", error=str(e))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
