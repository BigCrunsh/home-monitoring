"""Tankerkoenig API client implementation."""

import json
import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import httpx
from home_monitoring.core.exceptions import APIError
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger


class TankerkoenigClient:
    """Client for interacting with Tankerkoenig API."""

    def __init__(self, api_key: str, cache_dir: str | None = None) -> None:
        """Initialize the client.

        Args:
            api_key: Tankerkoenig API key
            cache_dir: Directory to cache station details. If None, disabled.
        """
        self._api_key = api_key
        self._cache_dir = Path(cache_dir) if cache_dir else None
        self._logger: BoundLogger = get_logger(__name__)

    async def get_prices(self, station_ids: Sequence[str]) -> dict[str, Any]:
        """Get current prices for gas stations.

        Args:
            station_ids: List of station IDs to get prices for

        Returns:
            API response with prices
        """
        self._logger.debug("getting_gas_prices", station_ids=station_ids)
        url = (
            "https://creativecommons.tankerkoenig.de/json/prices.php"
            f"?ids={','.join(station_ids)}&apikey={self._api_key}"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            self._logger.error(
                "failed_to_get_gas_prices",
                station_ids=station_ids,
                error=str(e),
            )
            raise APIError("Failed to get current prices") from e

    async def get_stations_details(
        self,
        station_ids: Sequence[str],
        force_update: bool = False,
    ) -> dict[str, Any]:
        """Get details for gas stations.

        Args:
            station_ids: List of station IDs to get details for
            force_update: Whether to force update from API even if cached

        Returns:
            API response with station details
        """
        self._logger.debug("getting_station_details", station_ids=station_ids)
        result = {}

        for station_id in station_ids:
            details = await self._get_station_detail(station_id, force_update)
            if details:
                result[station_id] = details

        return result

    async def _get_station_detail(
        self,
        station_id: str,
        force_update: bool = False,
    ) -> dict[str, Any] | None:
        """Get details for a single gas station.

        Args:
            station_id: Station ID to get details for
            force_update: Whether to force update from API even if cached

        Returns:
            API response with station details or None if not found
        """
        # Try to load from cache first
        if not force_update and self._cache_dir:
            cached = self._load_from_cache(station_id)
            if cached:
                return cached

        # Get from API
        url = (
            "https://creativecommons.tankerkoenig.de/json/detail.php"
            f"?id={station_id}&apikey={self._api_key}"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                # Cache the response
                if self._cache_dir and data.get("ok", False):
                    self._save_to_cache(station_id, data["station"])

                return data

        except Exception as e:
            self._logger.error(
                "failed_to_get_station_details",
                station_id=station_id,
                error=str(e),
            )
            raise APIError("Failed to get station details") from e

    def _load_from_cache(self, station_id: str) -> dict[str, Any] | None:
        """Load station details from cache.

        Args:
            station_id: Station ID to load details for

        Returns:
            Cached station details or None if not found
        """
        if not self._cache_dir:
            return None

        cache_file = self._cache_dir / f"{station_id}.json"
        if not cache_file.exists():
            return None

        try:
            with cache_file.open("r") as f:
                return json.load(f)
        except Exception as e:
            self._logger.error(
                "failed_to_load_cache",
                station_id=station_id,
                error=str(e),
            )
            return None

    def _save_to_cache(self, station_id: str, data: dict[str, Any]) -> None:
        """Save station details to cache.

        Args:
            station_id: Station ID the details belong to
            data: Station details to cache
        """
        if not self._cache_dir:
            return

        try:
            os.makedirs(self._cache_dir, exist_ok=True)
            cache_file = self._cache_dir / f"{station_id}.json"
            with cache_file.open("w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self._logger.error(
                "failed_to_save_cache",
                station_id=station_id,
                error=str(e),
            )
