"""Techem data mapping utilities."""
from datetime import datetime
from typing import Any, Sequence

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
                # Example response format: 4449244426c1002426c4d230000441302fd6700000000046d280c5929
                # First 8 bytes: Manufacturer ID (44492444)
                # Next 8 bytes: Meter ID (26c10024)
                # Next 8 bytes: Data (26c4d230)
                # Next 4 bytes: Configuration word
                # Next 4 bytes: Current value
                # Next 4 bytes: Previous value
                # Next 2 bytes: CRC
                if len(response) < 32:
                    continue

                # Convert response to hex string
                hex_str = response.decode('ascii')

                # Extract meter ID (8 bytes)
                meter_id = hex_str[8:16]

                # Extract media type (1 byte)
                media_type = hex_str[16:18]

                # Extract current value (4 bytes)
                value_bytes = bytes.fromhex(hex_str[24:32])
                value = int.from_bytes(value_bytes, byteorder="little") / 1000.0

                measurements.append(Measurement(
                    measurement="techem",
                    tags={
                        "meter_id": meter_id,
                        "type": media_type,
                    },
                    timestamp=timestamp,
                    fields={
                        "value": value,
                    },
                ))
            except Exception:
                continue

        return measurements
