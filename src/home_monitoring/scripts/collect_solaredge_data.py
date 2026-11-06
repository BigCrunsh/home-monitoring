#!/usr/bin/env python3
"""Write 15-minute energy (electricity_energy_watthour) from the logged meter counters.

The SolarEdge cloud API this used to call was retired on 2026-11-03. The energy now
comes from the inverter's lifetime counter (Modbus) and the grid meter's import/export
counters, which ioBroker logs to InfluxDB. The script keeps its name so the cron entry
stays valid.
"""

import asyncio
import sys
from datetime import UTC, datetime

from home_monitoring.services.energy_totals.service import EnergyTotalsService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


async def main() -> int:
    """Run the energy computation.

    Returns:
        Exit code
    """
    configure_logging()
    try:
        await EnergyTotalsService().collect(now=datetime.now(UTC))
    except Exception as e:
        logger.error("energy_totals_failed", error=str(e))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
