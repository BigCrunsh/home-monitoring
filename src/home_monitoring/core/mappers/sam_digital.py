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

    # Mapping from Sam Digital datapoint ID to
    # (measurement_name, field_key, human_readable_label)
    DATA_POINT_MAPPING: ClassVar[dict[str, tuple[str, str, str]]] = {
        # Außentemperatur AF1
        "MBR_10": (
            "heat_outdoor_temperature_celsius",
            "temperature",
            "Außentemperatur AF1",
        ),
        # Vorlauftemperatur VF1
        "MBR_13": (
            "heat_flow_temperature_celsius",
            "temperature",
            "Vorlauftemperatur VF1",
        ),
        # Rücklauftemperatur RüF2
        "MBR_18": (
            "heat_return_temperature_celsius",
            "temperature",
            "Rücklauftemperatur RüF2",
        ),
        # Speichertemperatur SF1
        "MBR_23": (
            "heat_storage_temperature_celsius",
            "temperature",
            "Speichertemperatur SF1",
        ),
        # Stellsignal HK2
        "MBR_109": (
            "heat_valve_signal_percentage",
            "signal",
            "Stellsignal HK2",
        ),
    }

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

            for datapoint in data_points:
                dp_id = datapoint.get("id")
                if not isinstance(dp_id, str):
                    continue

                if dp_id not in SamDigitalMapper.DATA_POINT_MAPPING:
                    continue

                value_raw = datapoint.get("value")
                value = SamDigitalMapper._to_float_or_none(value_raw)
                if value is None:
                    continue

                (
                    measurement_name,
                    field_key,
                    label,
                ) = SamDigitalMapper.DATA_POINT_MAPPING[dp_id]

                measurements.append(
                    Measurement(
                        measurement=measurement_name,
                        tags={
                            "id": dp_id,
                            "label": label,
                        },
                        timestamp=timestamp,
                        fields={field_key: value},
                    )
                )

        return measurements
