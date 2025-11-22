"""SolarEdge data mapping utilities."""

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement


class SolarEdgeMapper(BaseMapper):
    """Mapper for SolarEdge data to InfluxDB measurements."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        data: Mapping[str, Any],
        site_id: str | None = None,
    ) -> list[Measurement]:
        """Map SolarEdge detailed data to InfluxDB measurements.

        This function supports both /energyDetails and /powerDetails
        responses. It inspects the provided data for the corresponding
        root element and maps it to electricity_* measurements.
        """
        measurements: list[Measurement] = []

        if "powerDetails" in data:
            measurements.extend(
                SolarEdgeMapper._power_details_to_measurements(
                    data,
                    site_id=site_id,
                )
            )

        if "energyDetails" in data:
            measurements.extend(
                SolarEdgeMapper._energy_details_to_measurements(
                    data,
                    site_id=site_id,
                )
            )

        return measurements

    @staticmethod
    def _power_details_to_measurements(
        power_details: Mapping[str, Any],
        site_id: str | None = None,
    ) -> list[Measurement]:
        measurements: list[Measurement] = []

        if not power_details or "powerDetails" not in power_details:
            return measurements

        details = power_details["powerDetails"]
        unit = details.get("unit")
        if unit != "W":
            return measurements

        resolved_site_id = str(site_id or details.get("siteId", "unknown"))

        values_by_time: dict[datetime, dict[str, float]] = {}

        for meter in details.get("meters", []):
            meter_type = meter.get("type")
            if meter_type not in {
                "FeedIn",
                "SelfConsumption",
                "Purchased",
                "Consumption",
                "Production",
            }:
                continue

            for point in meter.get("values", []):
                date_str = point.get("date")
                value = point.get("value")
                if date_str is None or value is None:
                    continue

                try:
                    sample_time = datetime.fromisoformat(date_str)
                except ValueError:
                    continue

                per_time = values_by_time.setdefault(sample_time, {})
                per_time[meter_type] = float(value)

        for sample_time, meter_values in sorted(values_by_time.items()):
            measurements.append(
                Measurement(
                    measurement="electricity_power_watt",
                    tags={"site_id": resolved_site_id},
                    timestamp=sample_time,
                    fields={
                        "FeedIn": float(meter_values.get("FeedIn", 0.0)),
                        "SelfConsumption": float(
                            meter_values.get("SelfConsumption", 0.0)
                        ),
                        "Purchased": float(meter_values.get("Purchased", 0.0)),
                        "Consumption": float(meter_values.get("Consumption", 0.0)),
                        "Production": float(meter_values.get("Production", 0.0)),
                    },
                )
            )

        return measurements

    @staticmethod
    def _energy_details_to_measurements(
        energy_details: Mapping[str, Any],
        site_id: str | None = None,
    ) -> list[Measurement]:
        measurements: list[Measurement] = []

        if not energy_details or "energyDetails" not in energy_details:
            return measurements

        details = energy_details["energyDetails"]
        unit = details.get("unit")
        if unit != "Wh":
            return measurements

        resolved_site_id = str(site_id or details.get("siteId", "unknown"))

        values_by_time: dict[datetime, dict[str, float]] = {}

        for meter in details.get("meters", []):
            meter_type = meter.get("type")
            if meter_type not in {
                "FeedIn",
                "SelfConsumption",
                "Purchased",
                "Consumption",
                "Production",
            }:
                continue

            for point in meter.get("values", []):
                date_str = point.get("date")
                value = point.get("value")
                if date_str is None or value is None:
                    continue

                try:
                    sample_time = datetime.fromisoformat(date_str)
                except ValueError:
                    continue

                per_time = values_by_time.setdefault(sample_time, {})
                per_time[meter_type] = float(value)

        for sample_time, meter_values in sorted(values_by_time.items()):
            measurements.append(
                Measurement(
                    measurement="electricity_energy_watthour",
                    tags={"site_id": resolved_site_id},
                    timestamp=sample_time,
                    fields={
                        "FeedIn": float(meter_values.get("FeedIn", 0.0)),
                        "SelfConsumption": float(
                            meter_values.get("SelfConsumption", 0.0)
                        ),
                        "Purchased": float(meter_values.get("Purchased", 0.0)),
                        "Consumption": float(meter_values.get("Consumption", 0.0)),
                        "Production": float(meter_values.get("Production", 0.0)),
                    },
                )
            )

        return measurements
