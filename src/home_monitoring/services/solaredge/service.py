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

    def __init__(
        self,
        settings: Settings | None = None,
        repository: InfluxDBRepository | None = None,
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
            repository: InfluxDB repository. If not provided, created.

        Raises:
            ValueError: If required credentials are missing.
        """
        self._settings = settings or get_settings()
        self._db = repository or InfluxDBRepository(settings=self._settings)
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

    async def _get_energy_details(
        self,
        start_time: datetime,
        end_time: datetime,
        time_unit: str,
        meters: list[str] | None = None,
    ) -> dict:
        """Get detailed energy data from SolarEdge energyDetails API.

        Args:
            start_time: Start of the interval to query.
            end_time: End of the interval to query.
            time_unit: Requested time unit (e.g. DAY, WEEK, HOUR).
            meters: Optional list of meter types to request.

        Returns:
            Energy details response data.

        Raises:
            APIError: If the API request fails or response format is invalid.
        """
        url = (
            "https://monitoringapi.solaredge.com/site/"
            f"{self._settings.solaredge_site_id}/energyDetails"
        )
        params: dict[str, str] = {
            "api_key": self._settings.solaredge_api_key,
            "timeUnit": time_unit,
            "startTime": start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "endTime": end_time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        if meters:
            params["meters"] = ",".join(meters)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                if "energyDetails" not in data:
                    raise APIError("Invalid response format")
                return data
        except Exception as e:
            self._logger.error(
                "solaredge_api_request_failed",
                endpoint="energy_details",
                error=str(e),
            )
            raise APIError("SolarEdge API request failed") from e

    async def collect_and_store_energy_details(
        self,
        start_time: datetime,
        end_time: datetime,
        time_unit: str,
        meters: list[str] | None = None,
    ) -> None:
        """Collect energy details from SolarEdge and store in InfluxDB.

        This uses the /energyDetails endpoint to retrieve detailed energy
        data for the requested meters and writes them as
        electricity_energy_watthour measurements with fields FeedIn,
        SelfConsumption, Purchased, Consumption, and Production.
        """
        self._logger.info(
            "collecting_solaredge_energy_details",
            site_id=self._settings.solaredge_site_id,
            start_time=start_time,
            end_time=end_time,
            time_unit=time_unit,
            meters=meters,
        )

        try:
            energy_details = await self._get_energy_details(
                start_time,
                end_time,
                time_unit,
                meters,
            )
            measurements = SolarEdgeMapper.to_measurements(
                datetime.now(UTC),
                energy_details,
                site_id=str(self._settings.solaredge_site_id),
            )

            self._logger.info(
                "energy_details_measurements_created",
                measurement_count=len(measurements),
            )

            if not measurements:
                raise APIError(
                    "No SolarEdge energy details measurements created",
                )

            await self._db.write_measurements(measurements)
            self._logger.info(
                "solaredge_energy_details_stored",
                point_count=len(measurements),
                site_id=self._settings.solaredge_site_id,
            )
        except Exception as e:
            self._logger.error(
                "solaredge_energy_details_collection_failed",
                error=str(e),
                error_type=type(e).__name__,
                site_id=self._settings.solaredge_site_id,
            )
            raise

    async def _get_power_details(
        self,
        start_time: datetime,
        end_time: datetime,
        meters: list[str] | None = None,
    ) -> dict:
        """Get detailed power data from SolarEdge powerDetails API.

        Args:
            start_time: Start of the interval to query.
            end_time: End of the interval to query.
            meters: Optional list of meter types to request.

        Returns:
            Power details response data.

        Raises:
            APIError: If the API request fails or response format is invalid.
        """
        url = (
            "https://monitoringapi.solaredge.com/site/"
            f"{self._settings.solaredge_site_id}/powerDetails"
        )
        params: dict[str, str] = {
            "api_key": self._settings.solaredge_api_key,
            "startTime": start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "endTime": end_time.strftime("%Y-%m-%d %H:%M:%S"),
            "timeUnit": "QUARTER_OF_AN_HOUR",
        }
        if meters:
            params["meters"] = ",".join(meters)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                if "powerDetails" not in data:
                    raise APIError("Invalid response format")
                return data
        except Exception as e:
            self._logger.error(
                "solaredge_api_request_failed",
                endpoint="power_details",
                error=str(e),
            )
            raise APIError("SolarEdge API request failed") from e

    async def collect_and_store_power_details(
        self,
        start_time: datetime,
        end_time: datetime,
        meters: list[str] | None = None,
    ) -> None:
        """Collect power details from SolarEdge and store in InfluxDB.

        This uses the /powerDetails endpoint to retrieve quarter-hour
        resolution power data for the requested meters and writes them as
        electricity_power_watt measurements with fields FeedIn,
        SelfConsumption, Purchased, Consumption, and Production.
        """
        self._logger.info(
            "collecting_solaredge_power_details",
            site_id=self._settings.solaredge_site_id,
            start_time=start_time,
            end_time=end_time,
            meters=meters,
        )

        try:
            power_details = await self._get_power_details(start_time, end_time, meters)
            measurements = SolarEdgeMapper.to_measurements(
                datetime.now(UTC),
                power_details,
                site_id=str(self._settings.solaredge_site_id),
            )

            self._logger.info(
                "power_details_measurements_created",
                measurement_count=len(measurements),
            )

            if not measurements:
                raise APIError(
                    "No SolarEdge power details measurements created",
                )

            await self._db.write_measurements(measurements)
            self._logger.info(
                "solaredge_power_details_stored",
                point_count=len(measurements),
                site_id=self._settings.solaredge_site_id,
            )
        except Exception as e:
            self._logger.error(
                "solaredge_power_details_collection_failed",
                error=str(e),
                error_type=type(e).__name__,
                site_id=self._settings.solaredge_site_id,
            )
            raise
