"""Mapper for Sam Digital reader data to InfluxDB measurements."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class SamDigitalMapper(BaseMapper):
    """Mapper for Sam Digital reader data to InfluxDB measurements.

    The mapper expects a list of device dictionaries as returned by the
    Sam Digital API ``/devices`` endpoint. Each device may contain a
    ``"data"`` list with datapoints holding ``"id"`` and ``"value"``.

    Only a fixed set of known datapoint IDs is mapped to measurements.
    Unknown or non-numeric values are ignored.
    """

    # Mapping from Sam Digital datapoint ID to temperature field keys.
    # All temperatures are written into a single
    # `heat_temperature_celsius` measurement with multiple fields.
    TEMPERATURE_FIELDS: ClassVar[dict[str, str]] = {
        # Außentemperatur AF1
        "MBR_10": "outdoor",
        # Vorlauftemperatur VF1
        "MBR_13": "flow",
        # Rücklauftemperatur RüF2
        "MBR_18": "return",
        # Speichertemperatur SF1
        "MBR_23": "storage",
    }

    # Datapoint ID for the valve signal (Stellsignal HK2)
    VALVE_SIGNAL_ID: ClassVar[str] = "MBR_109"

    @staticmethod
    def _to_float_or_none(value: Any) -> float | None:
        if isinstance(value, int | float):
            return float(value)

        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return None

        return None

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        devices: Sequence[Mapping[str, Any]],
    ) -> list[Measurement]:
        """Map Sam Digital device data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp to use for all datapoints.
            devices: Iterable of devices returned by the Sam Digital API.

        Returns:
            List of InfluxDB measurements.
        """
        measurements: list[Measurement] = []

        for device in devices:
            data_points = device.get("data", [])
            if not isinstance(data_points, list):
                continue

            temperature_fields: dict[str, float] = {}
            valve_signal: float | None = None

            for datapoint in data_points:
                dp_id = datapoint.get("id")
                if not isinstance(dp_id, str):
                    continue

                value_raw = datapoint.get("value")
                value = SamDigitalMapper._to_float_or_none(value_raw)
                if value is None:
                    continue

                if dp_id in SamDigitalMapper.TEMPERATURE_FIELDS:
                    field_key = SamDigitalMapper.TEMPERATURE_FIELDS[dp_id]
                    temperature_fields[field_key] = value
                elif dp_id == SamDigitalMapper.VALVE_SIGNAL_ID:
                    valve_signal = value

            tags = SamDigitalMapper._build_tags(device)

            if temperature_fields:
                measurements.append(
                    Measurement(
                        measurement="heat_temperature_celsius",
                        tags=tags,
                        timestamp=timestamp,
                        fields=temperature_fields,
                    )
                )

            if valve_signal is not None:
                measurements.append(
                    Measurement(
                        measurement="heat_valve_signal_percentage",
                        tags=tags,
                        timestamp=timestamp,
                        fields={"signal": valve_signal},
                    )
                )

        return measurements

    @staticmethod
    def _build_tags(device: Mapping[str, Any]) -> dict[str, str]:
        """Build common tags for Sam Digital measurements.

        We attach device-level context rather than per-datapoint labels to
        match the aggregated measurement style used in SolarEdgeMapper.
        """
        tags: dict[str, str] = {}

        device_id = device.get("id")
        device_name = device.get("name")

        if device_id is not None:
            tags["device_id"] = str(device_id)
        if device_name is not None:
            tags["device_name"] = str(device_name)

        return tags
