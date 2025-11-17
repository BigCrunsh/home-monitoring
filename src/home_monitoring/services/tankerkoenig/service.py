"""Tankerkoenig service implementation."""
from datetime import datetime, timezone
from typing import Sequence

from structlog.stdlib import BoundLogger

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.tankerkoenig import TankerkoenigMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.tankerkoenig.client import TankerkoenigClient
from home_monitoring.utils.logging import get_logger


class TankerkoenigService:
    """Service for interacting with Tankerkoenig API."""

    # Default gas station IDs to monitor
    DEFAULT_STATION_IDS = [
        # Berlin - Lichtenberg
        "51d4b477-a095-1aa0-e100-80009459e03a",
        "005056ba-7cb6-1ed2-bceb-8e5fec1a0d35",
        # Hamburg
        "f0a4e043-ba25-49a2-b40e-3bd50cd2074c",
        "e78510fb-5292-4c50-837f-f55a17a4111a",
        "f820f0a1-7a9c-4d99-91fc-4b09514f4820",
        "92b37d44-73f5-417a-a838-e3c8ca480433",
        "005056ba-7cb6-1ed2-bceb-6e6ee17d4d20",
        "83c9acef-23a8-4eeb-924e-fb303bc93c5e",
        "51d4b4dc-a095-1aa0-e100-80009459e03a",
        # St.Peter
        "eea4cf7e-ae3e-4865-bc3b-1cbebd121061",
        "196d6a02-b44f-435e-b49c-a6eab994e8d9",
        # Angermuende
        "4393bf57-f3de-42e6-8d4d-9d6ca6a9a526",
    ]

    def __init__(
        self,
        settings: Settings | None = None,
        cache_dir: str | None = None,
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
            cache_dir: Directory to cache station details. If not provided, caching is disabled.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)
        self._client = TankerkoenigClient(
            api_key=self._settings.tankerkoenig_api_key,
            cache_dir=cache_dir,
        )

    async def collect_and_store(
        self,
        station_ids: Sequence[str] | None = None,
        force_update: bool = False,
    ) -> None:
        """Collect gas station prices and store in InfluxDB.

        Args:
            station_ids: List of station IDs to monitor. If not provided, uses default list.
            force_update: Whether to force update station details from API.
        """
        station_ids = station_ids or self.DEFAULT_STATION_IDS
        self._logger.info("collecting_gas_prices", station_count=len(station_ids))

        try:
            # Get current prices
            prices_response = await self._client.get_prices(station_ids)
            if not prices_response.get("ok", False):
                raise APIError(prices_response.get("message", "Unknown error"))

            # Get station details
            stations_response = await self._client.get_stations_details(station_ids, force_update)
            if not stations_response.get("ok", False):
                raise APIError(stations_response.get("message", "Unknown error"))

            # Map to InfluxDB measurements
            timestamp = datetime.now(timezone.utc)
            measurements = TankerkoenigMapper.to_measurements(timestamp, prices_response, stations_response)

            # Store in InfluxDB
            await self._db.write_measurements(measurements)
            self._logger.info("gas_prices_stored", point_count=len(measurements))
        except Exception as e:
            self._logger.error(
                "failed_to_store_gas_prices",
                error=str(e),
                measurements=measurements if "measurements" in locals() else None,
            )
            raise
