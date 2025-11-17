"""Techem data mapping utilities."""

from collections.abc import Sequence
from datetime import datetime

from home_monitoring.models.base import Measurement


class TechemMapper:
    """Mapper for Techem meter data to InfluxDB points."""

    @staticmethod
    def to_measurements(
        timestamp: datetime,
        responses: Sequence[bytes],
    ) -> list[Measurement]:
        """Map meter data to InfluxDB measurements.

        Args:
            timestamp: Measurement timestamp
            responses: Raw responses from meter

        Returns:
            List of InfluxDB measurements
        """
        measurements = []
        for response in responses:
            try:
                # Parse the response and create measurement
                # Example response format: b3644685045230153...
                # 0: 36 - number of bytes
                # 1: 44 - control field
                # 2-3: 5068 - vendor
                # 4-7: 53012345 - heat meter ID
                # 16-18: last period value
                # 20-22: current period value
                if len(response) < 32:
                    continue

                # Convert response to hex string with 'b' prefix
                hex_str = "b" + response.decode("ascii")

                # Extract meter ID (bytes 4-7)
                meter_id_bytes = ""
                for pos in [7, 6, 5, 4]:
                    meter_id_bytes += hex_str[pos * 2 + 1 : pos * 2 + 3]
                meter_id = str(int(meter_id_bytes))

                # Extract media type (byte 11)
                media_type = hex_str[11 * 2 + 1 : 11 * 2 + 3]

                # Extract values (bytes 16-18 and 20-22)
                last_period_bytes = ""
                for pos in [18, 17, 16]:
                    last_period_bytes += hex_str[pos * 2 + 1 : pos * 2 + 3]
                last_period = int(last_period_bytes, 16)

                current_period_bytes = ""
                for pos in [22, 21, 20]:
                    current_period_bytes += hex_str[pos * 2 + 1 : pos * 2 + 3]
                current_period = int(current_period_bytes, 16)

                value = (last_period + current_period) / 1000.0

                measurements.append(
                    Measurement(
                        measurement="techem",
                        tags={
                            "meter_id": meter_id,
                            "type": media_type,
                        },
                        timestamp=timestamp,
                        fields={
                            "value": value,
                        },
                    )
                )
            except Exception:
                continue

        return measurements
