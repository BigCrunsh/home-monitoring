"""Tankerkoenig data mapping utilities."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class TankerkoenigMapper(BaseMapper):
    """Mapper for Tankerkoenig gas station data to InfluxDB measurements."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        data: Mapping[str, Any],
    ) -> list[Measurement]:
        """Map gas station data to InfluxDB points.

        Args:
            timestamp: Measurement timestamp applied to all station points.
            data: Combined Tankerkoenig response data with ``"prices"`` and
                ``"stations"`` keys. Both values are expected to be mappings
                keyed by station ID:

                * ``prices[station_id]`` - mapping with fuel type fields such
                  as ``"e5"``, ``"e10"``, and ``"diesel"``.
                * ``stations[station_id]`` - mapping with station metadata
                  like ``"brand"``, ``"place"``, ``"street"``,
                  ``"houseNumber"``, ``"lat"``, and ``"lng"``.

        Returns:
            List of InfluxDB measurements
        """
        measurements = []
        prices = data.get("prices", {}) or {}
        stations = data.get("stations", {}) or {}

        for station_id, price_data in prices.items():
            if not price_data:
                continue

            # Get station details - if missing, use defaults to still record prices
            station = stations.get(station_id, {})

            measurements.append(
                Measurement(
                    measurement="gas_prices_euro",
                    tags={
                        "station_id": station_id,
                        "brand": station.get("brand", "unknown"),
                        "place": station.get("place", "unknown"),
                        "street": station.get("street", "unknown"),
                        "house_number": station.get("houseNumber", "unknown"),
                        "lat": str(station.get("lat", "unknown")),
                        "lng": str(station.get("lng", "unknown")),
                    },
                    timestamp=timestamp,
                    fields={
                        "e5": float(price_data.get("e5", 0.0)),
                        "e10": float(price_data.get("e10", 0.0)),
                        "diesel": float(price_data.get("diesel", 0.0)),
                    },
                )
            )

        return measurements
