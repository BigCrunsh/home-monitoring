"""Tibber service implementation."""

from datetime import datetime
from typing import Any

import tibber
from structlog.stdlib import BoundLogger

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.mappers.tibber import TibberMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger


class TibberService:
    """Service for interacting with Tibber API."""

    def __init__(
        self,
        settings: Settings | None = None,
        repository: InfluxDBRepository | None = None,
        user_agent: str = "Sawade Homemonitoring",
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
            repository: InfluxDB repository. If not provided, created.
            user_agent: User agent string to use for API requests
        """
        self._settings = settings or get_settings()
        self._db = repository or InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)
        self._user_agent = user_agent

    async def collect_and_store(self) -> None:
        """Collect electricity price data and store in InfluxDB."""
        self._logger.info("collecting_electricity_data")

        # Get price data from Tibber API
        price_data = await self._get_price_data()
        timestamp = datetime.fromisoformat(price_data.get("startsAt", ""))
        points = TibberMapper.to_measurements(timestamp, price_data)

        try:
            await self._db.write_measurements(points)
            self._logger.info(
                "tibber_data_stored",
                point_count=len(points),
            )
        except Exception as e:
            self._logger.error(
                "failed_to_store_electricity_data",
                error=str(e),
                points=points,
            )
            raise

    async def _get_price_data(self) -> dict[str, Any]:
        """Get current price data from Tibber API.

        Returns:
            Current price data
        """
        connection = tibber.Tibber(
            self._settings.tibber_access_token,
            user_agent=self._user_agent,
        )

        try:
            await connection.update_info()
            self._logger.debug("connected_to_tibber", name=connection.name)

            # Get first home's data
            homes = await connection.get_homes()
            home = homes[0]
            await home.fetch_consumption_data()
            await home.update_info()
            self._logger.debug("got_home_data", address=home.address1)

            return await home.current_price_data()
        finally:
            await connection.close_connection()
