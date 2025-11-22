"""Mapper for Tibber electricity data to InfluxDB measurements."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class TibberMapper(BaseMapper):
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
            # Calculate rank (0.0-1.0, where 0.0 is cheapest).
            # This would ideally come from the API or be calculated from
            # historical data. For now, we'll use the level field if
            # available and a string, otherwise default to NORMAL.
            raw_level = price_data.get("level", "NORMAL")
            level_key = raw_level.upper() if isinstance(raw_level, str) else "NORMAL"
            rank_map = {
                "VERY_CHEAP": 0.0,
                "CHEAP": 0.25,
                "NORMAL": 0.5,
                "EXPENSIVE": 0.75,
                "VERY_EXPENSIVE": 1.0,
            }
            rank = rank_map.get(level_key, 0.5)

            return [
                Measurement(
                    measurement="electricity_prices_euro",
                    tags={},
                    timestamp=timestamp,
                    fields={
                        "total": float(price_data.get("total", 0.0)),
                        "rank": rank,
                    },
                )
            ]
        except (TypeError, ValueError):
            return [
                Measurement(
                    measurement="electricity_prices_euro",
                    tags={},
                    timestamp=timestamp,
                    fields={
                        "total": 0.0,
                        "rank": 0.5,
                    },
                )
            ]
