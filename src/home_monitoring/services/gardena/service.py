"""Gardena smart system service implementation."""

from collections.abc import Callable
from datetime import datetime
from typing import Any

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.mappers.gardena import GardenaMapper
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger

from gardena import smart_system


class GardenaService:
    """Service for interacting with Gardena smart system."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository()
        self._logger: BoundLogger = get_logger(__name__)
        self._smart_system = smart_system.SmartSystem(
            client_id=self._settings.gardena_client_id,
            client_secret=self._settings.gardena_client_secret,
        )
        self._callbacks: list[tuple[str, Callable]] = []

    async def start(self) -> None:
        """Start the Gardena service and connect to devices."""
        self._logger.info("authenticating_with_gardena")
        self._smart_system.authenticate()
        self._smart_system.update_locations()

        if len(self._smart_system.locations) != 1:
            raise ValueError("Expected exactly one location")

        location = list(self._smart_system.locations.values())[0]
        self._smart_system.location = location
        self._smart_system.update_devices(location)
        self._smart_system.start_ws(location)

        self._logger.info(
            "devices_found",
            devices=[
                {"id": k, "name": v.name, "type": v.type}
                for k, v in location.devices.items()
            ],
        )

        # Set up device callbacks
        for device_type in ["SENSOR", "SMART_IRRIGATION_CONTROL", "SOIL_SENSOR"]:
            for device in location.find_device_by_type(device_type):
                device.add_callback(self._handle_device_update)

    async def stop(self) -> None:
        """Stop the Gardena service and disconnect from devices."""
        self._logger.info("stopping_gardena_service")
        self._smart_system.quit()

    async def _handle_device_update(self, device: Any) -> None:
        """Handle device updates and store data in InfluxDB.

        Args:
            device: Gardena device that was updated
        """
        time = datetime.utcnow()
        points = []

        try:
            if device.type == "SMART_IRRIGATION_CONTROL":
                points = GardenaMapper.control_data_to_points(device, time)
            elif device.type == "SENSOR":
                points = GardenaMapper.sensor_data_to_points(device, time)
            elif device.type == "SOIL_SENSOR":
                points = GardenaMapper.soil_sensor_data_to_points(device, time)
            else:
                self._logger.warning("unsupported_device_type", type=device.type)
                return

            self._logger.debug("writing_device_data", points=points)
            await self._db.write_measurements(
                [
                    Measurement(
                        measurement=point["measurement"],
                        tags=point["tags"],
                        timestamp=datetime.fromisoformat(point["time"]),
                        fields=point["fields"],
                    )
                    for point in points
                ]
            )
        except Exception as e:
            self._logger.error(
                "failed_to_handle_device_update",
                device_type=device.type,
                error=str(e),
            )
