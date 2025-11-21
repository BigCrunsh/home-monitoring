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
        prices: Mapping[str, Any],
        stations: Mapping[str, Any],
    ) -> list[Measurement]:
        """Map gas station data to InfluxDB points.

        Args:
            timestamp: Measurement timestamp
            prices: Current prices for stations
            stations: Station details

        Returns:
            List of InfluxDB measurements
        """
        measurements = []
        for station_id, price_data in prices.get("prices", {}).items():
            if not price_data:
                continue

            # Get station details
            station = stations.get("stations", {}).get(station_id, {})
            if not station:
                continue

            measurements.append(
                Measurement(
                    measurement="gas_prices_euro",
                    tags={
                        "station_id": station_id,
                        "name": station.get("name", "unknown"),
                        "brand": station.get("brand", "unknown"),
                        "street": station.get("street", "unknown"),
                        "place": station.get("place", "unknown"),
                        "postCode": str(station.get("postCode", "unknown")),
                        "open": str(station.get("isOpen", False)),
                    },
                    timestamp=timestamp,
                    fields={
                        "diesel": float(station.get("diesel", 0.0)),
                        "e5": float(station.get("e5", 0.0)),
                        "e10": float(station.get("e10", 0.0)),
                    },
                )
            )

        return measurements
