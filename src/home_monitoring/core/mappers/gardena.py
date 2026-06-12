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

        Creates separate measurements for each supported device/sensor type
        with descriptive measurement names.

        Args:
            timestamp: Measurement timestamp for all created points.
            device: Gardena device instance. The mapper recognises three
                ``device.type`` values:

                * ``"SMART_IRRIGATION_CONTROL"`` - uses ``state`` and
                  optional ``activity`` attributes to create
                  ``garden_valves_activity`` measurements.
                * ``"SENSOR"`` - uses attributes such as
                  ``ambient_temperature``, ``soil_humidity``,
                  ``light_intensity``, ``rf_link_level``, and
                  ``battery_level`` when present.
                * ``"SOIL_SENSOR"`` - uses ``soil_temperature`` and
                  ``soil_humidity`` when present.

        Returns:
            List of InfluxDB :class:`Measurement` instances for the given
            device. For unsupported device types an empty list is returned.
        """
        measurements = []

        # Common tags for all device types
        base_tags = {
            "id": device.id,
            "name": device.name,
            "type": device.type,
        }

        if device.type == "SMART_IRRIGATION_CONTROL":
            # The controller holds one valve per watering zone; emit a row per
            # valve. activity is e.g. CLOSED / MANUAL_WATERING / SCHEDULED_
            # WATERING; state=1 marks a valve that is actively watering.
            inactive = ("CLOSED", "UNKNOWN", "N/A", "")
            for valve in getattr(device, "valves", {}).values():
                activity = str(valve.get("activity", "UNKNOWN"))
                measurements.append(
                    Measurement(
                        measurement="garden_valves_activity",
                        tags={
                            **base_tags,
                            "valve_name": str(valve.get("name", "N/A")),
                            "activity": activity,
                        },
                        timestamp=timestamp,
                        fields={"state": 0 if activity in inactive else 1},
                    )
                )

        elif device.type == "SENSOR":
            # Ambient temperature measurement
            if (
                hasattr(device, "ambient_temperature")
                and device.ambient_temperature is not None
            ):
                measurements.append(
                    Measurement(
                        measurement="garden_temperature_celsius",
                        tags={
                            **base_tags,
                            "environment": "ambient",
                        },
                        timestamp=timestamp,
                        fields={"temperature": float(device.ambient_temperature)},
                    )
                )

            # Soil humidity measurement
            if hasattr(device, "soil_humidity") and device.soil_humidity is not None:
                measurements.append(
                    Measurement(
                        measurement="garden_humidity_percentage",
                        tags={
                            **base_tags,
                            "environment": "soil",
                        },
                        timestamp=timestamp,
                        fields={"humidity": float(device.soil_humidity)},
                    )
                )

            # Light intensity measurement
            if (
                hasattr(device, "light_intensity")
                and device.light_intensity is not None
            ):
                measurements.append(
                    Measurement(
                        measurement="garden_light_intensity_lux",
                        tags=base_tags,
                        timestamp=timestamp,
                        fields={"light_intensity": float(device.light_intensity)},
                    )
                )

            # RF link level measurement (if available)
            if hasattr(device, "rf_link_level") and device.rf_link_level is not None:
                measurements.append(
                    Measurement(
                        measurement="garden_rf_link_level_percentage",
                        tags=base_tags,
                        timestamp=timestamp,
                        fields={"rf_link_level": float(device.rf_link_level)},
                    )
                )

            # Battery level measurement (if available)
            if hasattr(device, "battery_level") and device.battery_level is not None:
                measurements.append(
                    Measurement(
                        measurement="garden_system_battery_percentage",
                        tags=base_tags,
                        timestamp=timestamp,
                        fields={"battery_level": float(device.battery_level)},
                    )
                )

        elif device.type == "SOIL_SENSOR":
            # Soil temperature measurement
            if (
                hasattr(device, "soil_temperature")
                and device.soil_temperature is not None
            ):
                measurements.append(
                    Measurement(
                        measurement="garden_temperature_celsius",
                        tags={
                            **base_tags,
                            "environment": "soil",
                            "sensor_type": "soil",
                        },
                        timestamp=timestamp,
                        fields={"temperature": float(device.soil_temperature)},
                    )
                )

            # Soil humidity measurement
            if hasattr(device, "soil_humidity") and device.soil_humidity is not None:
                measurements.append(
                    Measurement(
                        measurement="garden_humidity_percentage",
                        tags={
                            **base_tags,
                            "environment": "soil",
                        },
                        timestamp=timestamp,
                        fields={"humidity": float(device.soil_humidity)},
                    )
                )

        return measurements
