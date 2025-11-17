"""Netatmo data mapping utilities."""

from datetime import datetime
from collections.abc import Mapping, Sequence
from typing import Any

from home_monitoring.models.base import Measurement


class NetatmoMapper:
    """Mapper for Netatmo weather station data to InfluxDB measurements."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        devices: Sequence[Mapping[str, Any]],
    ) -> list[Measurement]:
        """Map weather station data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            devices: List of Netatmo devices with their data

        Returns:
            List of InfluxDB measurements
        """
        points = []
        for device in devices:
            # Base station data
            required_keys = ["_id", "type", "module_name"]
            if not all(key in device for key in required_keys):
                continue

            if "dashboard_data" in device:
                fields = {
                    field: value
                    for field, value in device["dashboard_data"].items()
                    if not isinstance(value, int | float)
                }
                if fields:
                    points.append(
                        Measurement(
                            measurement="netatmo",
                            tags={
                                "device_id": device["_id"],
                                "type": device["type"],
                                "module_name": device["module_name"],
                            },
                            timestamp=timestamp,
                            fields=fields,
                        )
                    )

            # Module data
            for module in device.get("modules", []):
                required_keys = ["_id", "type", "module_name"]
                if not all(key in module for key in required_keys):
                    continue

                if "dashboard_data" not in module:
                    continue

                fields = {
                    field: value
                    for field, value in module["dashboard_data"].items()
                    if not isinstance(value, int | float)
                }
                if fields:
                    points.append(
                        Measurement(
                            measurement="netatmo",
                            tags={
                                "device_id": module["_id"],
                                "type": module["type"],
                                "module_name": module["module_name"],
                            },
                            timestamp=timestamp,
                            fields=fields,
                        )
                    )

        return points
