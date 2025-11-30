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
        data: Mapping[str, Any],
        data_type: str = "price",
    ) -> list[Measurement]:
        """Map Tibber data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp (typically UTC-aware).
            data: Tibber data payload whose expected structure depends on
                ``data_type``:

                * ``"price"`` (default): mapping with at least ``"total"``
                  (numeric). Optionally contains ``"level"`` with one of
                  ``VERY_CHEAP``, ``CHEAP``, ``NORMAL``, ``EXPENSIVE``, or
                  ``VERY_EXPENSIVE``. Other keys are ignored.
                * ``"cost"``: mapping with keys ``"cost"`` (numeric) and
                  ``"period"`` (string tag such as ``"last_hour"``,
                  ``"yesterday"``, or ``"last_24h"``).
                * ``"consumption"``: mapping with keys ``"consumption"``
                  (numeric) and ``"period"`` (string tag as for
                  ``"cost"``).

            data_type: Type of data: ``"price"``, ``"cost"``, or
                ``"consumption"``.

        Returns:
            List of InfluxDB :class:`Measurement` instances representing the
            given Tibber data.
        """
        if data_type == "cost":
            return [
                Measurement(
                    measurement="electricity_costs_euro",
                    tags={"period": str(data.get("period", "unknown"))},
                    timestamp=timestamp,
                    fields={"cost": float(data.get("cost", 0.0))},
                )
            ]

        if data_type == "consumption":
            return [
                Measurement(
                    measurement="electricity_consumption_kwh",
                    tags={"period": str(data.get("period", "unknown"))},
                    timestamp=timestamp,
                    fields={"consumption": float(data.get("consumption", 0.0))},
                )
            ]

        # Default: price data
        try:
            # Calculate rank (0.0-1.0, where 0.0 is cheapest).
            # This would ideally come from the API or be calculated from
            # historical data. For now, we'll use the level field if
            # available and a string, otherwise default to NORMAL.
            raw_level = data.get("level", "NORMAL")
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
                        "total": float(data.get("total", 0.0)),
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
