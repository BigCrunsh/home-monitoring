"""SolarEdge data mapping utilities."""

from datetime import datetime
from collections.abc import Mapping
from typing import Any

from home_monitoring.models.base import Measurement


class SolarEdgeMapper:
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
        points = []

        # Overview data
        if overview and "overview" in overview:
            data = overview["overview"]
            points.append(
                Measurement(
                    measurement="solaredge",
                    tags={
                        "type": "overview",
                    },
                    timestamp=timestamp,
                    fields={
                        "lifetime_energy": float(
                            overview["overview"]["lifeTimeData"]["energy"]
                        ),
                        "last_year_energy": float(
                            overview["overview"]["lastYearData"]["energy"]
                        ),
                        "last_month_energy": float(
                            overview["overview"]["lastMonthData"]["energy"]
                        ),
                        "last_day_energy": float(
                            overview["overview"]["lastDayData"]["energy"]
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
            points.append(
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

        return points
