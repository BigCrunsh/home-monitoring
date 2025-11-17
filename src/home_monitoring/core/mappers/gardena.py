"""Gardena data mapping utilities."""

from datetime import datetime
from typing import Any

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class GardenaMapper(BaseMapper):
    """Mapper for Gardena device data to InfluxDB points."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        device: Any,
    ) -> list[Measurement]:
        """Map Gardena device data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            device: Gardena device (irrigation control, sensor, or soil sensor)

        Returns:
            List of InfluxDB measurements
        """
        # Common tags for all device types
        tags = {
            "device_id": device.id,
            "name": device.name,
            "type": device.type,
        }

        # Fields depend on device type
        fields = {}
        if device.type == "SMART_IRRIGATION_CONTROL":
            fields = {
                "state": device.state,
                "activity": device.activity,
            }
        elif device.type == "SENSOR":
            fields = {
                "soil_temperature": device.soil_temperature,
                "soil_humidity": device.soil_humidity,
                "light_intensity": device.light_intensity,
                "ambient_temperature": device.ambient_temperature,
            }
        elif device.type == "SOIL_SENSOR":
            fields = {
                "soil_temperature": device.soil_temperature,
                "soil_humidity": device.soil_humidity,
            }

        return [
            Measurement(
                measurement="gardena",
                tags=tags,
                timestamp=timestamp,
                fields=fields,
            )
        ]
