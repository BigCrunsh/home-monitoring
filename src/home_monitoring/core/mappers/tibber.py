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
    ) -> list[Measurement]:
        """Map Tibber data to InfluxDB measurements.

        The mapper infers which measurements to emit from the keys present in
        ``data``:

        * If ``"cost"`` and ``"period"`` are present, an
          ``electricity_costs_euro`` measurement is produced.
        * If ``"consumption"`` and ``"period"`` are present, an
          ``electricity_consumption_kwh`` measurement is produced.
        * If ``"total"`` is present, an ``electricity_prices_euro``
          measurement is produced using the optional ``"level"`` field to
          derive a rank in ``[0.0, 1.0]``.
        * If none of these keys are present, a default
          ``electricity_prices_euro`` measurement with ``total=0.0`` and
          ``rank=0.5`` is returned (for backwards compatibility with previous
          behaviour when called with an empty mapping).

        Args:
            timestamp: Measurement timestamp (typically UTC-aware).
            data: Tibber data payload containing one or more of the supported
                keys described above.

        Returns:
            List of InfluxDB :class:`Measurement` instances representing the
            given Tibber data. Multiple measurements may be returned if
            ``data`` contains both cost and consumption information.
        """
        measurements: list[Measurement] = []

        if "cost" in data and "period" in data:
            measurements.append(
                Measurement(
                    measurement="electricity_costs_euro",
                    tags={"period": str(data.get("period", "unknown"))},
                    timestamp=timestamp,
                    fields={"cost": float(data.get("cost", 0.0))},
                )
            )

        if "consumption" in data and "period" in data:
            tags = {"period": str(data.get("period", "unknown"))}
            if "source" in data:
                tags["source"] = str(data.get("source"))
            measurements.append(
                Measurement(
                    measurement="electricity_consumption_kwh",
                    tags=tags,
                    timestamp=timestamp,
                    fields={"consumption": float(data.get("consumption", 0.0))},
                )
            )

        if "total" in data:
            try:
                # Calculate rank (0.0-1.0, where 0.0 is cheapest).
                raw_level = data.get("level", "NORMAL")
                level_key = (
                    raw_level.upper() if isinstance(raw_level, str) else "NORMAL"
                )
                rank_map = {
                    "VERY_CHEAP": 0.0,
                    "CHEAP": 0.25,
                    "NORMAL": 0.5,
                    "EXPENSIVE": 0.75,
                    "VERY_EXPENSIVE": 1.0,
                }
                rank = rank_map.get(level_key, 0.5)

                measurements.append(
                    Measurement(
                        measurement="electricity_prices_euro",
                        tags={},
                        timestamp=timestamp,
                        fields={
                            "total": float(data.get("total", 0.0)),
                            "rank": rank,
                        },
                    )
                )
            except (TypeError, ValueError):
                measurements.append(
                    Measurement(
                        measurement="electricity_prices_euro",
                        tags={},
                        timestamp=timestamp,
                        fields={
                            "total": 0.0,
                            "rank": 0.5,
                        },
                    )
                )
        elif not ("cost" in data and "period" in data) and not (
            "consumption" in data and "period" in data
        ):
            # Preserve previous behaviour for empty/unsupported payloads by
            # returning a default price measurement.
            measurements.append(
                Measurement(
                    measurement="electricity_prices_euro",
                    tags={},
                    timestamp=timestamp,
                    fields={
                        "total": 0.0,
                        "rank": 0.5,
                    },
                )
            )

        return measurements
