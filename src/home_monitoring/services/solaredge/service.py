"""SolarEdge service implementation."""

from datetime import UTC, datetime

import httpx
from home_monitoring.config import Settings, get_settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.solaredge import SolarEdgeMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger


class SolarEdgeService:
    """Service for interacting with SolarEdge API."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository(settings=self._settings)
        self._logger: BoundLogger = get_logger(__name__)

    async def collect_and_store(self) -> None:
        """Collect current data from SolarEdge and store in InfluxDB."""
        self._logger.info("collecting_solaredge_data")

        try:
            # Get current data
            overview = await self._get_overview()
            power_flow = await self._get_power_flow()

            # Map to InfluxDB measurements
            timestamp = datetime.now(UTC)
            measurements = SolarEdgeMapper.to_measurements(
                timestamp, overview, power_flow
            )

            # Store in InfluxDB
            await self._db.write_measurements(measurements)
            self._logger.info(
                "solaredge_data_stored",
                point_count=len(measurements),
            )
        except Exception as e:
            self._logger.error(
                "solaredge_data_collection_failed",
                error=str(e),
                site_id=self._settings.solaredge_site_id,
            )
            raise

    async def _get_overview(self) -> dict:
        """Get current overview data from SolarEdge API.

        Returns:
            Overview data response

        Raises:
            APIError: If the API request fails or response format is invalid
        """
        url = (
            "https://monitoringapi.solaredge.com/site/"
            f"{self._settings.solaredge_site_id}/overview"
        )
        params = {"api_key": self._settings.solaredge_api_key}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                await response.raise_for_status()
                data = await response.json()
                if "overview" not in data:
                    raise APIError("Invalid response format")
                return data
        except Exception as e:
            self._logger.error(
                "solaredge_api_request_failed",
                endpoint="overview",
                error=str(e),
            )
            raise APIError("SolarEdge API request failed") from e

    async def _get_power_flow(self) -> dict:
        """Get current power flow data from SolarEdge API.

        Returns:
            Power flow data response

        Raises:
            APIError: If the API request fails or response format is invalid
        """
        url = (
            "https://monitoringapi.solaredge.com/site/"
            f"{self._settings.solaredge_site_id}/currentPowerFlow"
        )
        params = {"api_key": self._settings.solaredge_api_key}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                await response.raise_for_status()
                data = await response.json()
                if "siteCurrentPowerFlow" not in data:
                    raise APIError("Invalid response format")
                return data
        except Exception as e:
            self._logger.error(
                "solaredge_api_request_failed",
                endpoint="power_flow",
                error=str(e),
            )
            raise APIError("SolarEdge API request failed") from e
