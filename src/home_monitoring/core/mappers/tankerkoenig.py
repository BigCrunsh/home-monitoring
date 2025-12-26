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

            # Skip closed stations - they return 0 or invalid prices
            if price_data.get("status") == "closed":
                continue

            # Skip stations with all zero prices (likely data quality issue)
            e5_price = price_data.get("e5", 0.0)
            e10_price = price_data.get("e10", 0.0)
            diesel_price = price_data.get("diesel", 0.0)
            
            zero_price = 0.0
            all_zero = (
                e5_price == zero_price
                and e10_price == zero_price
                and diesel_price == zero_price
            )
            if all_zero:
                continue

            # Get station details - if missing, use defaults to still record prices
            station = stations.get(station_id, {})

            # Normalize text fields to title case for consistency
            brand = station.get("brand", "unknown")
            place = station.get("place", "unknown")
            street = station.get("street", "unknown")
            house_number = station.get("houseNumber", "unknown")
            post_code = station.get("postCode", "unknown")

            # Apply title case to text fields (handles mixed case from API)
            if brand != "unknown":
                brand = brand.title()
            if place != "unknown":
                place = place.title()
            if street != "unknown":
                street = street.title()
            if house_number != "unknown":
                house_number = str(house_number)
            if post_code != "unknown":
                post_code = str(post_code)

            measurements.append(
                Measurement(
                    measurement="gas_prices_euro",
                    tags={
                        "station_id": station_id,
                        "brand": brand,
                        "place": place,
                        "street": street,
                        "house_number": house_number,
                        "post_code": post_code,
                        "lat": str(station.get("lat", "unknown")),
                        "lng": str(station.get("lng", "unknown")),
                    },
                    timestamp=timestamp,
                    fields={
                        "e5": e5_price,
                        "e10": e10_price,
                        "diesel": diesel_price,
                    },
                )
            )

        return measurements
