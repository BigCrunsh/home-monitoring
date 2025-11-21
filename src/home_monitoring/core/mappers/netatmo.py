"""Netatmo data mapping utilities."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class NetatmoMapper(BaseMapper):
    """Mapper for Netatmo weather station data to InfluxDB measurements."""

    # Mapping from dashboard data fields to measurement names and units
    FIELD_MAPPING: ClassVar[dict[str, tuple[str, str]]] = {
        "Temperature": ("weather_temperature_celsius", "Temperature"),
        "Humidity": ("weather_humidity_percentage", "Humidity"),
        "CO2": ("weather_co2_ppm", "CO2"),
        "Noise": ("weather_noise_db", "Noise"),
        "Pressure": ("weather_pressure_mbar", "Pressure"),
        "AbsolutePressure": ("weather_absolute_pressure_mbar", "AbsolutePressure"),
        "Rain": ("weather_rain_mm", "Rain"),
        "WindStrength": ("weather_windstrength_kph", "WindStrength"),
        "WindAngle": ("weather_windangle_angles", "WindAngle"),
        "GustStrength": ("weather_guststrength_kph", "GustStrength"),
        "GustAngle": ("weather_gustangle_angles", "GustAngle"),
    }

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        devices: Sequence[Mapping[str, Any]],
    ) -> list[Measurement]:
        """Map weather station data to InfluxDB measurements.

        Creates separate measurements for each sensor type (temperature,
        humidity, etc.) with descriptive names and appropriate units.

        Args:
            timestamp: Measurement timestamp
            devices: List of Netatmo devices with their data

        Returns:
            List of InfluxDB measurements
        """
        measurements = []

        for device in devices:
            # Process base station data
            measurements.extend(NetatmoMapper._process_device_data(device, timestamp))

            # Process module data
            for module in device.get("modules", []):
                measurements.extend(
                    NetatmoMapper._process_device_data(module, timestamp)
                )

        return measurements

    @staticmethod
    def _process_device_data(
        device: Mapping[str, Any], timestamp: datetime
    ) -> list[Measurement]:
        """Process individual device/module data into measurements."""
        measurements = []

        # Check required fields
        required_keys = ["_id", "type", "module_name"]
        if not all(key in device for key in required_keys):
            return measurements

        # Process dashboard data (sensor readings)
        if "dashboard_data" in device:
            dashboard_data = device["dashboard_data"]

            for field_name, value in dashboard_data.items():
                if not isinstance(value, int | float):
                    continue

                if field_name in NetatmoMapper.FIELD_MAPPING:
                    measurement_name, field_key = NetatmoMapper.FIELD_MAPPING[
                        field_name
                    ]
                    measurements.append(
                        Measurement(
                            measurement=measurement_name,
                            tags={
                                "module_name": device["module_name"],
                                "device_id": device["_id"],
                                "type": device["type"],
                            },
                            timestamp=timestamp,
                            fields={field_key: float(value)},
                        )
                    )

        # Process battery data if available
        if "battery_percent" in device:
            measurements.append(
                Measurement(
                    measurement="weather_system_battery_percentage",
                    tags={
                        "module_name": device["module_name"],
                        "device_id": device["_id"],
                        "type": device["type"],
                    },
                    timestamp=timestamp,
                    fields={"Battery": float(device["battery_percent"])},
                )
            )

        return measurements
