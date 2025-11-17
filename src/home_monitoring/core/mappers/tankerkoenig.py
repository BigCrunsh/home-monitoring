"""Tankerkoenig data mapping utilities."""

from datetime import datetime
from collections.abc import Mapping
from typing import Any

from home_monitoring.models.base import Measurement


class TankerkoenigMapper:
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
            List of InfluxDB points
        """
        points = []
        for station_id, price_data in prices.get("prices", {}).items():
            if not price_data:
                continue

            # Get station details
            station = stations.get(station_id, {})
            if not station:
                continue

            points.append(
                Measurement(
                    measurement="gas_prices",
                    tags={
                        "station_id": station_id,
                        "name": station.get("name", "unknown"),
                        "brand": station.get("brand", "unknown"),
                        "street": station.get("street", "unknown"),
                        "place": station.get("place", "unknown"),
                        "post_code": station.get("postCode", "unknown"),
                    },
                    timestamp=timestamp,
                    fields={
                        "diesel": price_data.get("diesel", 0.0),
                        "e5": price_data.get("e5", 0.0),
                        "e10": price_data.get("e10", 0.0),
                        "is_open": price_data.get("status", "closed") == "open",
                    },
                )
            )

        return points
