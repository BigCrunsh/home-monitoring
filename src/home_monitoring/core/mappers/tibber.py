"""Tibber data mapping utilities."""
from typing import Any


class TibberMapper:
    """Mapper for Tibber electricity data to InfluxDB points."""

    @staticmethod
    def to_points(price_data: dict[str, Any]) -> list[dict[str, Any]]:
        """Map electricity price data to InfluxDB points.

        Args:
            price_data: Current price data from Tibber API

        Returns:
            List of InfluxDB points
        """
        try:
            return [
                {
                    "measurement": "electricity_prices",
                    "tags": {
                        "currency": str(price_data.get("currency", "unknown")),
                        "level": str(price_data.get("level", "unknown")),
                    },
                    "time": price_data.get("startsAt"),
                    "fields": {
                        "total": float(price_data.get("total", 0.0)),
                        "energy": float(price_data.get("energy", 0.0)),
                        "tax": float(price_data.get("tax", 0.0)),
                    },
                }
            ]
        except (TypeError, ValueError):
            return [
                {
                    "measurement": "electricity_prices",
                    "tags": {
                        "currency": "unknown",
                        "level": "unknown",
                    },
                    "time": None,
                    "fields": {
                        "total": 0.0,
                        "energy": 0.0,
                        "tax": 0.0,
                    },
                }
            ]
