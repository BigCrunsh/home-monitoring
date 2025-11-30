"""Sam Digital reader service implementation."""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import httpx
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.sam_digital import SamDigitalMapper
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.base import BaseService


class SamDigitalService(BaseService):
    """Service for interacting with the Sam Digital reader API."""

    def __init__(
        self,
        settings: Settings | None = None,
        repository: InfluxDBRepository | None = None,
        base_url: str = "https://komdat.sam-digital.net/api/public/v1",
    ) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, loaded from env.
            repository: InfluxDB repository. If not provided, created.
            base_url: Base URL of the Sam Digital API.

        Raises:
            ValueError: If the required API key is missing.
        """
        super().__init__(settings=settings, repository=repository)
        self._base_url = base_url.rstrip("/")

        if not self._settings.sam_digital_api_key:
            raise ValueError(
                "Missing Sam Digital API key. Please set SAM_DIGITAL_API_KEY "
                "environment variable."
            )

    async def _fetch_devices(self) -> Sequence[dict[str, Any]]:
        """Fetch devices from Sam Digital API.

        Returns:
            List of device dictionaries.

        Raises:
            APIError: If the API request fails or response format is invalid.
        """
        url = f"{self._base_url}/devices"
        headers = {
            "Accept": "application/json",
            "X-sde-api-key": self._settings.sam_digital_api_key,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:  # pragma: no cover - network issues
            self._logger.error(
                "sam_digital_api_request_failed",
                endpoint="/devices",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise APIError("Sam Digital API request failed") from exc

        items = data.get("items")
        if not isinstance(items, list):
            self._logger.error(
                "sam_digital_invalid_response_format",
                data_type=type(data).__name__,
            )
            raise APIError("Invalid Sam Digital API response format")

        self._logger.info(
            "sam_digital_devices_received",
            device_count=len(items),
        )

        return items

    async def collect_and_store(self) -> None:
        """Collect reader data from Sam Digital and store in InfluxDB."""
        self._logger.info("collecting_sam_digital_data")

        devices = await self._fetch_devices()
        timestamp = datetime.now(UTC)
        measurements = SamDigitalMapper.to_measurements(timestamp, devices)

        self._logger.info(
            "sam_digital_mapping_result",
            device_count=len(devices),
            measurement_count=len(measurements),
        )

        if not measurements:
            self._logger.error(
                "no_sam_digital_measurements_created",
                device_count=len(devices),
            )
            raise APIError("No Sam Digital measurements created")

        try:
            await self._db.write_measurements(measurements)
            self._logger.info(
                "sam_digital_data_stored",
                point_count=len(measurements),
            )
        except Exception as exc:  # pragma: no cover - database path
            self._logger.error(
                "failed_to_store_sam_digital_data",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise
