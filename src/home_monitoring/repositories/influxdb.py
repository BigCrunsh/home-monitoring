"""InfluxDB repository implementation."""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from aioinflux import InfluxDBClient as BaseInfluxDBClient
from home_monitoring.config import Settings, get_settings
from home_monitoring.models.base import Measurement
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger


class InfluxDBRepository:
    """Repository for InfluxDB operations."""

    def __init__(
        self,
        settings: Settings | None = None,
        client: BaseInfluxDBClient | None = None,
    ) -> None:
        """Initialize the repository.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
            client: InfluxDB client. If not provided, a new client will be created.
        """
        self._settings = settings or get_settings()
        self._client = client or self._create_client()
        self._logger: BoundLogger = get_logger(__name__)

    def _create_client(self) -> BaseInfluxDBClient:
        """Create InfluxDB client.

        Returns:
            InfluxDB client
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return BaseInfluxDBClient(
            host=self._settings.influxdb_host,
            port=self._settings.influxdb_port,
            db=self._settings.influxdb_database,
            username=self._settings.influxdb_username,
            password=self._settings.influxdb_password,
            loop=loop,
        )

    async def get_latest_timestamp(self, measurement: str) -> datetime | None:
        """Get the latest timestamp for a measurement.

        Args:
            measurement: Name of the measurement

        Returns:
            Latest timestamp or None if no data exists
        """
        query = f"SELECT * from {measurement} ORDER BY DESC LIMIT 1"
        try:
            result = await self._client.query(query)
            if not result:
                return None

            points = list(result["results"][0]["series"][0]["values"])
            if not points:
                return None

            return datetime.fromisoformat(points[0][0].rstrip("Z"))
        except Exception as e:
            self._logger.error(
                "failed_to_get_latest_timestamp",
                measurement=measurement,
                error=str(e),
            )
            raise

    async def write_measurement(self, measurement: Measurement) -> None:
        """Write a measurement to InfluxDB.

        Args:
            measurement: Measurement to write
        """
        data = {
            "measurement": measurement.measurement,
            "tags": measurement.tags,
            "fields": measurement.fields,
            "time": measurement.timestamp.isoformat(),
        }
        try:
            await self._write_points([data])
        except Exception as e:
            self._logger.error(
                "failed_to_write_measurement",
                measurement=measurement.measurement,
                error=str(e),
            )
            raise

    async def _write_points(self, points: list[dict[str, Any]]) -> None:
        """Write points to InfluxDB.

        Args:
            points: Points to write
        """
        await self._client.write(points)

    async def write_measurements(self, measurements: list[Measurement]) -> None:
        """Write multiple measurements to InfluxDB.

        Args:
            measurements: List of measurements to write
        """
        points = [
            {
                "measurement": m.measurement,
                "tags": m.tags,
                "fields": m.fields,
                "time": m.timestamp.isoformat(),
            }
            for m in measurements
        ]
        try:
            await self._client.write(points)
        except Exception as e:
            self._logger.error(
                "failed_to_write_measurements",
                count=len(measurements),
                error=str(e),
            )
            raise

    async def query(self, query: str) -> AsyncIterator[dict[str, Any]]:
        """Execute a query against InfluxDB.

        Args:
            query: InfluxDB query string

        Yields:
            Query results as dictionaries
        """
        try:
            result = await self._client.query(query)
            if not result or "results" not in result:
                return

            for series in result["results"][0].get("series", []):
                columns = series["columns"]
                for values in series["values"]:
                    yield dict(zip(columns, values, strict=False))
        except Exception as e:
            self._logger.error(
                "failed_to_execute_query",
                query=query,
                error=str(e),
            )
            raise
