"""Gardena smart system service implementation."""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from home_monitoring.config import Settings
from home_monitoring.core.mappers.gardena import GardenaMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.base import BaseService

from gardena.smart_system import SmartSystem


class GardenaService(BaseService):
    """Service for interacting with Gardena smart system."""

    def __init__(
        self,
        settings: Settings | None = None,
        repository: InfluxDBRepository | None = None,
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
            repository: InfluxDB repository. If not provided, created.
        """
        super().__init__(settings=settings, repository=repository)

        # Validate required credentials
        if not all(
            [
                self._settings.gardena_application_id,
                self._settings.gardena_application_secret,
                self._settings.gardena_email,
                self._settings.gardena_password,
            ]
        ):
            raise ValueError(
                "Missing Gardena credentials. Please set "
                "GARDENA_APPLICATION_ID, GARDENA_APPLICATION_SECRET, "
                "GARDENA_EMAIL, and GARDENA_PASSWORD environment variables."
            )

        self._smart_system = SmartSystem(
            client_id=self._settings.gardena_application_id,
            client_secret=self._settings.gardena_application_secret,
        )
        self._callbacks: list[tuple[str, Callable[..., Any]]] = []

    async def start(self) -> None:
        """Start the Gardena service and connect to devices."""
        self._logger.info("authenticating_with_gardena")
        await self._smart_system.authenticate()
        await self._smart_system.update_locations()

        if len(self._smart_system.locations) != 1:
            raise ValueError("Expected exactly one location")

        location = next(iter(self._smart_system.locations.values()))
        self._smart_system.location = location
        await self._smart_system.update_devices(location)
        await self._smart_system.start_ws(location)

        self._logger.info(
            "devices_found",
            devices=[
                {"id": k, "name": v.name, "type": v.type}
                for k, v in location.devices.items()
            ],
        )

        # Set up device callbacks
        device_types = ["SENSOR", "SMART_IRRIGATION_CONTROL", "SOIL_SENSOR"]
        for device_type in device_types:
            for device in location.find_device_by_type(device_type):
                device.add_callback(self._handle_device_update)

    async def stop(self) -> None:
        """Stop the Gardena service and disconnect from devices."""
        self._logger.info("stopping_gardena_service")
        await self._smart_system.quit()

    async def _handle_device_update(self, device: Any) -> None:
        """Handle device updates and store data in InfluxDB.

        Args:
            device: Gardena device that was updated
        """
        timestamp = datetime.now(UTC)

        try:
            measurements = GardenaMapper.to_measurements(timestamp, device)
            if not measurements:
                self._logger.warning(
                    "unsupported_device_type",
                    type=device.type,
                )
                return

            self._logger.debug(
                "writing_device_data",
                measurements=measurements,
            )
            await self._db.write_measurements(measurements)
        except Exception as e:
            self._logger.error(
                "failed_to_handle_device_update",
                device_type=device.type,
                error=str(e),
                error_type=type(e).__name__,
            )
