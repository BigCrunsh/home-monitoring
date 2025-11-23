#!/usr/bin/env python3
"""Collect data from SolarEdge API."""
import asyncio
import sys
from datetime import UTC, datetime, timedelta

from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.solaredge import SolarEdgeService
from home_monitoring.utils.logging import configure_logging


async def main() -> int:
    """Run the data collection.

    Returns:
        Exit code
    """
    configure_logging()
    service = SolarEdgeService()
    repository = InfluxDBRepository()
    now = datetime.now(UTC)

    try:
        # Collect detailed energy data starting from latest stored timestamp
        latest_energy = await repository.get_latest_timestamp(
            "electricity_energy_watthour"
        )
        energy_window_start = now - timedelta(days=30)
        # If no data yet, start at window start; otherwise clamp latest to the window
        energy_start = max(latest_energy or energy_window_start, energy_window_start)
        energy_meters = [
            "PRODUCTION",
            "CONSUMPTION",
            "SELFCONSUMPTION",
            "FEEDIN",
            "PURCHASED",
        ]

        await service.collect_and_store_energy_details(
            start_time=energy_start,
            end_time=now,
            time_unit="QUARTER_OF_AN_HOUR",
            meters=energy_meters,
        )

        # Collect detailed power data starting from latest stored timestamp
        latest_power = await repository.get_latest_timestamp("electricity_power_watt")
        power_window_start = now - timedelta(days=30)
        power_start = max(latest_power or power_window_start, power_window_start)
        power_meters = [
            "PRODUCTION",
            "CONSUMPTION",
            "SELFCONSUMPTION",
            "FEEDIN",
            "PURCHASED",
        ]

        await service.collect_and_store_power_details(
            start_time=power_start,
            end_time=now,
            meters=power_meters,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
