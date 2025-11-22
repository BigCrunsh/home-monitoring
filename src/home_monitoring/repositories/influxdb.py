"""InfluxDB repository implementation."""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from aioinflux import InfluxDBClient as BaseInfluxDBClient
from home_monitoring.config import Settings, get_settings
from home_monitoring.models.base import Measurement
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger

EPOCH_DIGITS_NS = 19
EPOCH_DIGITS_US = 16
EPOCH_DIGITS_MS = 13


class InfluxDBRepository:
    """Repository for InfluxDB operations."""

    def __init__(
        self,
        settings: Settings | None = None,
        client: BaseInfluxDBClient | None = None,
    ) -> None:
        """Initialize the repository.

        Args:
            settings: Application settings. If not provided, loaded from env.
            client: InfluxDB client. If not provided, new client created.
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
        query = f"SELECT * from {measurement} ORDER BY time DESC LIMIT 1"
        try:
            result = await self._client.query(query)
            if not result:
                return None

            points = list(result["results"][0]["series"][0]["values"])
            if not points:
                return None

            raw_time = points[0][0]

            # InfluxDB may return the timestamp either as an ISO8601 string
            # (e.g. "2025-11-22T17:38:04Z") or as an integer epoch value.
            # Handle both cases and always return a timezone-aware UTC
            # datetime so callers can safely compare it with other UTC times.

            # String timestamp (RFC3339/ISO8601)
            if isinstance(raw_time, str):
                value = raw_time
                if value.endswith("Z"):
                    value = value.replace("Z", "+00:00")
                dt = datetime.fromisoformat(value)
                return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)

            # Integer/float epoch timestamp (ns/us/ms/s)
            if isinstance(raw_time, int | float):
                epoch = int(raw_time)
                digits = len(str(abs(epoch)))

                # Heuristic based on digit count
                if digits >= EPOCH_DIGITS_NS:  # nanoseconds
                    seconds = epoch / 1_000_000_000
                elif digits >= EPOCH_DIGITS_US:  # microseconds
                    seconds = epoch / 1_000_000
                elif digits >= EPOCH_DIGITS_MS:  # milliseconds
                    seconds = epoch / 1_000
                else:  # seconds
                    seconds = float(epoch)

                return datetime.fromtimestamp(seconds, tz=UTC)

            self._logger.error(
                "unexpected_timestamp_type",
                measurement=measurement,
                raw_time=raw_time,
                raw_type=type(raw_time).__name__,
            )
            return None
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
            await self._client.write([data])
        except Exception as e:
            self._logger.error(
                "failed_to_write_measurement",
                measurement=measurement.measurement,
                error=str(e),
            )
            raise

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
