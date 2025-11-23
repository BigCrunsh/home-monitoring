"""Netatmo weather station service implementation."""

from datetime import UTC, datetime
from typing import Any

import lnetatmo
from home_monitoring.config import Settings, get_settings
from home_monitoring.core.mappers.netatmo import NetatmoMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger


class NetatmoService:
    """Service for interacting with Netatmo weather station."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)

        # Validate required credentials for new lnetatmo library
        if not all(
            [
                self._settings.netatmo_client_id,
                self._settings.netatmo_client_secret,
            ]
        ):
            raise ValueError(
                "Missing Netatmo credentials. Please set NETATMO_CLIENT_ID, "
                "NETATMO_CLIENT_SECRET, and NETATMO_REFRESH_TOKEN "
                "environment variables."
            )

        # Initialize authentication with lnetatmo using environment variables
        # The lnetatmo library will automatically use NETATMO_REFRESH_TOKEN
        # from environment if not passed directly
        try:
            self._auth = lnetatmo.ClientAuth(
                clientId=self._settings.netatmo_client_id,
                clientSecret=self._settings.netatmo_client_secret,
                refreshToken=self._settings.netatmo_refresh_token,
            )
            self._api = lnetatmo.WeatherStationData(self._auth)
        except lnetatmo.AuthFailure as e:
            raise ValueError(
                f"Netatmo authentication failed: {e}. "
                "You may need to generate a refresh token. "
                "See https://github.com/philippelt/netatmo-api-python"
            ) from e
        except Exception as e:
            raise ValueError(f"Failed to initialize Netatmo API: {e}") from e

    async def collect_and_store(self) -> None:
        """Collect weather station data and store in InfluxDB."""
        self._logger.info("collecting_weather_data")

        if not await self._get_data():
            raise RuntimeError("Failed to get weather station data")

        timestamp = datetime.now(UTC)
        # Get device data from lnetatmo API
        devices_data = self._get_devices_data()
        measurements = NetatmoMapper.to_measurements(timestamp, devices_data)

        try:
            await self._db.write_measurements(measurements)
            self._logger.info(
                "netatmo_data_stored",
                point_count=len(measurements),
            )
        except Exception as e:
            self._logger.error(
                "failed_to_store_weather_data",
                error=str(e),
                measurements=measurements,
            )
            raise

    async def _get_data(self) -> bool:
        """Get data from Netatmo API using lnetatmo library.

        Returns:
            True if successful, False otherwise
        """
        try:
            self._logger.debug("calling_lnetatmo_api")
            # Log authentication details (without sensitive info)
            self._logger.debug(
                "lnetatmo_auth_info",
                has_client_id=bool(getattr(self._auth, "clientId", None)),
                has_client_secret=bool(getattr(self._auth, "clientSecret", None)),
                has_access_token=bool(getattr(self._auth, "accessToken", None)),
            )

            # The lnetatmo library handles authentication automatically
            # Access data, which will trigger auth if needed
            stations = self._api.stations
            self._logger.debug(
                "lnetatmo_api_result",
                station_count=len(stations) if stations else 0,
                has_access_token_after=bool(getattr(self._auth, "accessToken", None)),
            )
            return len(stations) > 0 if stations else False
        except lnetatmo.AuthFailure as e:
            self._logger.error(
                "failed_to_get_weather_data",
                error=f"Authentication failed: {e!s}",
                error_type="AuthFailure",
                suggestion="Netatmo authentication failed. You may need to "
                "generate a refresh token or check your client credentials. "
                "See https://github.com/philippelt/netatmo-api-python",
            )
            return False
        except Exception as e:
            self._logger.error(
                "failed_to_get_weather_data",
                error=str(e),
                error_type=type(e).__name__,
                suggestion="Check network connectivity and Netatmo API status.",
            )
            return False

    def _get_devices_data(self) -> list[dict[str, Any]]:
        """Get device data in format compatible with NetatmoMapper.
        Returns:
            List of device data compatible with the existing mapper
        """
        try:
            # Convert lnetatmo station data to format expected by mapper
            devices_data = []
            for station_id in self._api.stations:
                station_data = self._api.stationById(station_id)
                if station_data:
                    devices_data.append(station_data)
            return devices_data
        except Exception as e:
            self._logger.error(
                "failed_to_get_devices_data", error=str(e), error_type=type(e).__name__
            )
            return []
