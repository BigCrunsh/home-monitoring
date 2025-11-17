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
        """Map irrigation control data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            device: Gardena irrigation control device

        Returns:
            List of InfluxDB measurements
        """
        return [
            Measurement(
                measurement="gardena",
                tags={
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                timestamp=timestamp,
                fields={
                    "state": device.state,
                    "activity": device.activity,
                },
            )
        ]

    @staticmethod
    def sensor_data_to_measurements(
        timestamp: datetime,
        device: Any,
    ) -> list[Measurement]:
        """Map sensor data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            device: Gardena sensor device

        Returns:
            List of InfluxDB measurements
        """
        return [
            Measurement(
                measurement="gardena",
                tags={
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                timestamp=timestamp,
                fields={
                    "soil_temperature": device.soil_temperature,
                    "soil_humidity": device.soil_humidity,
                    "light_intensity": device.light_intensity,
                    "ambient_temperature": device.ambient_temperature,
                },
            )
        ]

    @staticmethod
    def soil_sensor_data_to_measurements(
        timestamp: datetime,
        device: Any,
    ) -> list[Measurement]:
        """Map soil sensor data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            device: Gardena soil sensor device

        Returns:
            List of InfluxDB measurements
        """
        return [
            Measurement(
                measurement="gardena",
                tags={
                    "device_id": device.id,
                    "name": device.name,
                    "type": device.type,
                },
                timestamp=timestamp,
                fields={
                    "soil_temperature": device.soil_temperature,
                    "soil_humidity": device.soil_humidity,
                },
            )
        ]
