"""SolarEdge data mapping utilities."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class SolarEdgeMapper(BaseMapper):
    """Mapper for SolarEdge data to InfluxDB measurements."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        overview: Mapping[str, Any],
        power_flow: Mapping[str, Any],
    ) -> list[Measurement]:
        """Map SolarEdge data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            overview: Overview data from API
            power_flow: Power flow data from API

        Returns:
            List of InfluxDB measurements
        """
        measurements = []

        # Overview data
        if overview and "overview" in overview:
            data = overview["overview"]
            measurements.append(
                Measurement(
                    measurement="solaredge",
                    tags={
                        "type": "overview",
                    },
                    timestamp=timestamp,
                    fields={
                        "lifetime_energy": float(
                            data.get("lifeTimeData", {}).get("energy", 0.0)
                        ),
                        "last_year_energy": float(
                            data.get("lastYearData", {}).get("energy", 0.0)
                        ),
                        "last_month_energy": float(
                            data.get("lastMonthData", {}).get("energy", 0.0)
                        ),
                        "last_day_energy": float(
                            data.get("lastDayData", {}).get("energy", 0.0)
                        ),
                        "current_power": data.get(
                            "currentPower", {}
                        ).get("power", 0.0),
                    },
                )
            )

        # Power flow data
        if power_flow and "siteCurrentPowerFlow" in power_flow:
            data = power_flow["siteCurrentPowerFlow"]
            measurements.append(
                Measurement(
                    measurement="solaredge",
                    tags={
                        "type": "power_flow",
                        "unit": data.get("unit", "W"),
                    },
                    timestamp=timestamp,
                    fields={
                        "grid_power": data.get("grid", {}).get(
                            "currentPower", 0.0
                        ),
                        "load_power": data.get("load", {}).get(
                            "currentPower", 0.0
                        ),
                        "pv_power": data.get("pv", {}).get(
                            "currentPower", 0.0
                        ),
                    },
                )
            )

        return measurements
