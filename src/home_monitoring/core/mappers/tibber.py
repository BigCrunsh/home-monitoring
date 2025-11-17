"""Mapper for Tibber electricity data to InfluxDB measurements."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from home_monitoring.models.base import Measurement


class TibberMapper:
    """Mapper for Tibber electricity data to InfluxDB measurements."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        price_data: Mapping[str, Any],
    ) -> list[Measurement]:
        """Map electricity price data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            price_data: Electricity price data from Tibber API

        Returns:
            List of InfluxDB measurements
        """
        try:
            return [
                Measurement(
                    measurement="electricity_prices",
                    tags={
                        "currency": price_data.get("currency", "unknown"),
                        "level": price_data.get("level", "unknown"),
                    },
                    timestamp=timestamp,
                    fields={
                        "total": float(price_data.get("total", 0.0)),
                        "energy": float(price_data.get("energy", 0.0)),
                        "tax": float(price_data.get("tax", 0.0)),
                    },
                )
            ]
        except (TypeError, ValueError):
            return [
                Measurement(
                    measurement="electricity_prices",
                    tags={
                        "currency": "unknown",
                        "level": "unknown",
                    },
                    timestamp=timestamp,
                    fields={
                        "total": 0.0,
                        "energy": 0.0,
                        "tax": 0.0,
                    },
                )
            ]
