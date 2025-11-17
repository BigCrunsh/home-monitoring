"""Netatmo weather station service implementation."""
from datetime import datetime, timezone

import netatmo
from structlog.stdlib import BoundLogger

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.mappers.netatmo import NetatmoMapper
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger


class NetatmoService:
    """Service for interacting with Netatmo weather station."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)
        self._api = netatmo.WeatherStation({
            'client_id': self._settings.netatmo_client_id,
            'client_secret': self._settings.netatmo_client_secret,
            'username': self._settings.netatmo_username,
            'password': self._settings.netatmo_password,
        })

    async def collect_and_store(self) -> None:
        """Collect weather station data and store in InfluxDB."""
        self._logger.info("collecting_weather_data")
        
        if not await self._get_data():
            raise RuntimeError("Failed to get weather station data")

        timestamp = datetime.now(timezone.utc)
        measurements = NetatmoMapper.to_measurements(self._api.devices, timestamp)

        try:
            await self._db.write_measurements(measurements)
            self._logger.info("weather_data_stored", point_count=len(measurements))
        except Exception as e:
            self._logger.error(
                "failed_to_store_weather_data",
                error=str(e),
                measurements=measurements,
            )
            raise

    async def _get_data(self) -> bool:
        """Get data from Netatmo API.

        Returns:
            True if successful, False otherwise
        """
        try:
            return await self._api.get_data()
        except Exception as e:
            self._logger.error(
                "failed_to_get_weather_data",
                error=str(e),
            )
            return False
