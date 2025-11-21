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

        Raises:
            ValueError: If required credentials are missing.
        """
        self._settings = settings or get_settings()
        self._db = InfluxDBRepository()
        self._logger: BoundLogger = get_logger(__name__)

        # Validate required credentials
        if not all(
            [
                self._settings.solaredge_api_key,
                self._settings.solaredge_site_id,
            ]
        ):
            raise ValueError(
                "Missing SolarEdge credentials. Please set SOLAREDGE_API_KEY "
                "and SOLAREDGE_SITE_ID environment variables."
            )

    async def collect_and_store(self) -> None:
        """Collect current data from SolarEdge and store in InfluxDB."""
        self._logger.info(
            "collecting_solaredge_data", site_id=self._settings.solaredge_site_id
        )

        try:
            # Get current data
            self._logger.debug("fetching_overview_data")
            overview = await self._get_overview()
            self._logger.debug(
                "overview_data_received",
                has_overview=bool(overview.get("overview")),
                overview_keys=(
                    list(overview.get("overview", {}).keys())
                    if overview.get("overview")
                    else []
                ),
            )

            self._logger.debug("fetching_power_flow_data")
            power_flow = await self._get_power_flow()
            self._logger.debug(
                "power_flow_data_received",
                has_power_flow=bool(power_flow.get("siteCurrentPowerFlow")),
                power_flow_keys=(
                    list(power_flow.get("siteCurrentPowerFlow", {}).keys())
                    if power_flow.get("siteCurrentPowerFlow")
                    else []
                ),
            )

            # Map to InfluxDB measurements
            timestamp = datetime.now(UTC)
            measurements = SolarEdgeMapper.to_measurements(
                timestamp, overview, power_flow
            )

            self._logger.info(
                "measurements_created",
                measurement_count=len(measurements),
                measurement_names=[m.measurement for m in measurements],
                measurement_types=[m.tags.get("type") for m in measurements],
            )

            # Log detailed measurement info for debugging
            for i, measurement in enumerate(measurements):
                self._logger.debug(
                    f"measurement_{i+1}_details",
                    name=measurement.measurement,
                    tags=measurement.tags,
                    fields=list(measurement.fields.keys()),
                    field_values={k: v for k, v in measurement.fields.items()},
                )

            # Store in InfluxDB
            await self._db.write_measurements(measurements)
            self._logger.info(
                "solaredge_data_stored",
                point_count=len(measurements),
                site_id=self._settings.solaredge_site_id,
            )
        except Exception as e:
            self._logger.error(
                "solaredge_data_collection_failed",
                error=str(e),
                error_type=type(e).__name__,
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
                response.raise_for_status()
                data = response.json()
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
                response.raise_for_status()
                data = response.json()
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
