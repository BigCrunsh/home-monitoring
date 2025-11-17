"""Techem data mapping utilities."""

from collections.abc import Sequence
from datetime import datetime

from home_monitoring.core.mappers.base import BaseMapper
from home_monitoring.models.base import Measurement
from home_monitoring.utils.logging import get_logger


class TechemMapper(BaseMapper):
    """Mapper for Techem meter data to InfluxDB points."""

    EXPECTED_RESPONSE_LENGTH = 46  # Length of hex string response
    _logger = get_logger(__name__)

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
                hex_str = response.decode("ascii")
                TechemMapper._logger.debug("parsing_response", hex_str=hex_str)
                if len(hex_str) != TechemMapper.EXPECTED_RESPONSE_LENGTH:
                    TechemMapper._logger.debug(
                        "invalid_response_length",
                        length=len(hex_str),
                        expected=TechemMapper.EXPECTED_RESPONSE_LENGTH,
                    )
                    continue

                # Extract meter ID (bytes 4-7)
                meter_id_bytes = ""
                for pos in [7, 6, 5, 4]:
                    meter_id_bytes += hex_str[pos * 2:(pos * 2) + 2]
                meter_id = str(int(meter_id_bytes))
                TechemMapper._logger.debug(
                    "parsed_meter_id",
                    meter_id=meter_id,
                )

                # Extract media type (byte 11)
                media_type = hex_str[11 * 2:(11 * 2) + 2]
                TechemMapper._logger.debug(
                    "parsed_media_type",
                    media_type=media_type,
                )

                # Extract values (bytes 16-18 and 20-22)
                last_period_bytes = ""
                for pos in [18, 17, 16]:
                    last_period_bytes += hex_str[pos * 2:(pos * 2) + 2]
                last_period = int(last_period_bytes, 16)

                current_period_bytes = ""
                for pos in [22, 21, 20]:
                    current_period_bytes += hex_str[pos * 2:(pos * 2) + 2]
                current_period = int(current_period_bytes, 16)

                value = (last_period + current_period) / 1000.0
                TechemMapper._logger.debug(
                    "parsed_value",
                    last_period=last_period,
                    current_period=current_period,
                    value=value,
                )

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
            except Exception as e:
                TechemMapper._logger.debug(
                    "failed_to_parse_response",
                    error=str(e),
                )
                continue

        return measurements
