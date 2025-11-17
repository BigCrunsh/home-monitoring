"""Techem service implementation."""
import asyncio
from datetime import datetime, timezone
from typing import Sequence

import serial
from structlog.stdlib import BoundLogger

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.techem import TechemMapper
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger


class TechemService:
    """Service for collecting Techem meter data via serial port."""

    def __init__(
        self,
        settings: Settings | None = None,
        port: str = "/dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0",
        baudrate: int = 38400,
        timeout: int = 300,
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
            port: Serial port to listen on
            baudrate: Serial port baudrate
            timeout: Serial port timeout in seconds
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)
        self._port = port
        self._baudrate = baudrate
        self._timeout = timeout

    async def collect_and_store(self, num_packets: int = 5) -> None:
        """Collect meter data and store in InfluxDB.

        Args:
            num_packets: Number of data packets to collect. Should be larger than
                number of receivable IDs.
        """
        self._logger.info(
            "starting_data_collection",
            port=self._port,
            baudrate=self._baudrate,
        )

        try:
            # Get meter data
            responses = await self._get_meter_data(num_packets)

            # Map to InfluxDB measurements
            timestamp = datetime.now(timezone.utc)
            measurements = TechemMapper.to_measurements(timestamp, responses)

            if not measurements:
                raise APIError("No meter data received")

            # Store in InfluxDB
            await self._db.write_measurements(measurements)
            self._logger.info("meter_data_stored", point_count=len(measurements))
        except Exception as e:
            self._logger.error(
                "failed_to_collect_meter_data",
                error=str(e),
            )
            raise

    async def _get_meter_data(self, num_packets: int) -> list[bytes]:
        """Get meter data from serial port.

        Args:
            num_packets: Number of packets to collect

        Returns:
            List of meter data responses

        Raises:
            APIError: If the serial port fails or data is invalid
        """
        try:
            # Initialize serial port
            ser = serial.Serial(
                self._port,
                self._baudrate,
                timeout=self._timeout,
            )
            await asyncio.sleep(2)  # Wait for port to be ready

            if not ser.is_open:
                raise APIError("Failed to open serial port")

            # Get version info
            ser.write(b'V\r\n')
            version = ser.readline().rstrip().decode('utf-8')
            if not version:
                raise APIError("Failed to get device version")
            self._logger.info("device_version", version=version)

            # Set WMBUS mode
            ser.write(b'brt\r\n')
            mode = ser.readline().rstrip().decode('utf-8')
            if not mode:
                raise APIError("Failed to set WMBUS mode")
            self._logger.info("wmbus_mode", mode=mode)

            # Collect responses
            responses = []
            for _ in range(num_packets):
                response = ser.readline()
                if response:
                    self._logger.debug("received_packet", data=response)
                    responses.append(response)

            if not responses:
                raise APIError("No meter data received")

            self._logger.info(
                "responses_collected",
                count=len(responses),
                distinct=len(set(responses)),
            )

            return responses
        except Exception as e:
            self._logger.error(
                "failed_to_get_meter_data",
                error=str(e),
            )
            raise APIError(f"Failed to get meter data: {e}")
        finally:
            if 'ser' in locals() and ser.is_open:
                ser.close()
