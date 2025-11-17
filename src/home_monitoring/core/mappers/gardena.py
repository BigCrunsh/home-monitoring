"""Gardena data mapping utilities."""
from datetime import datetime
from typing import Any


class GardenaMapper:
    """Mapper for Gardena device data to InfluxDB points."""

    @staticmethod
    def control_data_to_points(device: Any, timestamp: datetime) -> list[dict[str, Any]]:
        """Map irrigation control data to InfluxDB points.

        Args:
            device: Gardena irrigation control device
            timestamp: Measurement timestamp

        Returns:
            List of InfluxDB points
        """
        return [
            {
                "measurement": "gardena",
                "tags": {
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                "time": timestamp.isoformat(),
                "fields": {
                    "state": device.state,
                    "activity": device.activity,
                },
            }
        ]

    @staticmethod
    def sensor_data_to_points(device: Any, timestamp: datetime) -> list[dict[str, Any]]:
        """Map sensor data to InfluxDB points.

        Args:
            device: Gardena sensor device
            timestamp: Measurement timestamp

        Returns:
            List of InfluxDB points
        """
        return [
            {
                "measurement": "gardena",
                "tags": {
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                "time": timestamp.isoformat(),
                "fields": {
                    "ambient_temperature": device.ambient_temperature,
                    "light_intensity": device.light_intensity,
                    "soil_temperature": device.soil_temperature,
                    "soil_humidity": device.soil_humidity,
                },
            }
        ]

    @staticmethod
    def soil_sensor_data_to_points(device: Any, timestamp: datetime) -> list[dict[str, Any]]:
        """Map soil sensor data to InfluxDB points.

        Args:
            device: Gardena soil sensor device
            timestamp: Measurement timestamp

        Returns:
            List of InfluxDB points
        """
        return [
            {
                "measurement": "gardena",
                "tags": {
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                "time": timestamp.isoformat(),
                "fields": {
                    "soil_temperature": device.soil_temperature,
                    "soil_humidity": device.soil_humidity,
                },
            }
        ]
