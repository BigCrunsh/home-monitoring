"""Tibber service implementation."""

from datetime import UTC, datetime
from typing import Any, TypedDict

from home_monitoring.config import Settings, get_settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.tibber import TibberMapper
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger

import tibber


class ConsumptionData(TypedDict):
    """Type definition for consumption data."""

    from_time: datetime
    to_time: datetime
    consumption: float
    cost: float
    unit_price: float
    currency: str


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
        starts_at = price_data.get("startsAt")
        if not starts_at:
            timestamp = datetime.now(UTC)
        else:
            parsed_timestamp = datetime.fromisoformat(starts_at)
            if parsed_timestamp.tzinfo is None:
                timestamp = parsed_timestamp.replace(tzinfo=UTC)
            else:
                timestamp = parsed_timestamp.astimezone(UTC)

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
                error_type=type(e).__name__,
                points=points,
            )
            raise

    async def collect_and_store_consumption_data(self) -> None:
        """Collect and store consumption and cost data for all periods in InfluxDB."""
        self._logger.info("collecting_consumption_and_cost_data")
        timestamp = datetime.now(UTC)
        measurements: list[Measurement] = []

        try:
            # Collect last hour data
            try:
                last_hour_cost = await self.get_last_hour_cost()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"cost": last_hour_cost, "period": "last_hour"},
                        data_type="cost",
                    )
                )
            except ValueError as e:
                self._logger.warning("failed_to_get_last_hour_cost", error=str(e))

            try:
                last_hour_consumption = await self.get_last_hour_consumption()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"consumption": last_hour_consumption, "period": "last_hour"},
                        data_type="consumption",
                    )
                )
            except ValueError as e:
                self._logger.warning(
                    "failed_to_get_last_hour_consumption", error=str(e)
                )

            # Collect yesterday data
            try:
                yesterday_cost = await self.get_yesterday_cost()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"cost": yesterday_cost, "period": "yesterday"},
                        data_type="cost",
                    )
                )
            except ValueError as e:
                self._logger.warning("failed_to_get_yesterday_cost", error=str(e))

            try:
                yesterday_consumption = await self.get_yesterday_consumption()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"consumption": yesterday_consumption, "period": "yesterday"},
                        data_type="consumption",
                    )
                )
            except ValueError as e:
                self._logger.warning(
                    "failed_to_get_yesterday_consumption", error=str(e)
                )

            # Collect last 24h data
            try:
                last_24h_cost = await self.get_last_24h_cost()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"cost": last_24h_cost, "period": "last_24h"},
                        data_type="cost",
                    )
                )
            except ValueError as e:
                self._logger.warning("failed_to_get_last_24h_cost", error=str(e))

            try:
                last_24h_consumption = await self.get_last_24h_consumption()
                measurements.extend(
                    TibberMapper.to_measurements(
                        timestamp,
                        {"consumption": last_24h_consumption, "period": "last_24h"},
                        data_type="consumption",
                    )
                )
            except ValueError as e:
                self._logger.warning("failed_to_get_last_24h_consumption", error=str(e))

            # Store all measurements
            if measurements:
                await self._db.write_measurements(measurements)
                self._logger.info(
                    "consumption_and_cost_data_stored",
                    point_count=len(measurements),
                )
            else:
                self._logger.warning("no_consumption_or_cost_data_to_store")

        except Exception as e:
            self._logger.error(
                "failed_to_store_consumption_and_cost_data",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def _get_price_data(self) -> dict[str, Any]:
        """Get current price data from Tibber API.

        Returns:
            Current price data
        """
        connection = tibber.Tibber(  # type: ignore[attr-defined]
            self._settings.tibber_access_token,
            user_agent=self._user_agent,
        )

        try:
            try:
                await connection.update_info()
                self._logger.debug("connected_to_tibber", name=connection.name)

                # Get first home's data
                homes = connection.get_homes()
                home = homes[0]
                await home.fetch_consumption_data()
                await home.update_info()
                self._logger.debug("got_home_data", address=home.address1)

                # current_price_data() returns tuple: (total, datetime, rank)
                total, starts_at, rank = home.current_price_data()

                # Convert tuple to expected dictionary format
                return {
                    "total": total,
                    "startsAt": starts_at.isoformat() if starts_at else "",
                    "rank": rank,
                    "currency": "EUR",  # Default currency
                    "level": "NORMAL",  # Default level
                    "energy": total * 0.8 if total else 0.0,  # Estimate energy portion
                    "tax": total * 0.2 if total else 0.0,  # Estimate tax portion
                }
            except Exception as exc:  # pragma: no cover - network issues
                self._logger.error(
                    "tibber_api_request_failed",
                    error=str(exc),
                    error_type=type(exc).__name__,
                )
                raise APIError("Tibber API request failed") from exc
        finally:
            await connection.close_connection()

    async def get_last_hour_cost(self) -> float:
        """Get total energy cost for the last hour.

        Returns:
            Total cost in EUR for the last complete hour

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("HOURLY", last=1)
        if not consumption_data:
            raise ValueError("No hourly consumption data available")
        return consumption_data[0]["cost"]

    async def get_last_hour_consumption(self) -> float:
        """Get total energy consumption for the last hour.

        Returns:
            Total consumption in kWh for the last complete hour

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("HOURLY", last=1)
        if not consumption_data:
            raise ValueError("No hourly consumption data available")
        return consumption_data[0]["consumption"]

    async def get_yesterday_cost(self) -> float:
        """Get total energy cost for yesterday.

        Returns:
            Total cost in EUR for the previous day

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("DAILY", last=1)
        if not consumption_data:
            raise ValueError("No daily consumption data available")
        return consumption_data[0]["cost"]

    async def get_yesterday_consumption(self) -> float:
        """Get total energy consumption for yesterday.

        Returns:
            Total consumption in kWh for the previous day

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("DAILY", last=1)
        if not consumption_data:
            raise ValueError("No daily consumption data available")
        return consumption_data[0]["consumption"]

    async def get_last_24h_cost(self) -> float:
        """Get total energy cost for the last 24 hours.

        Returns:
            Total cost in EUR for the last 24 hours (sum of hourly costs)

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("HOURLY", last=24)
        if not consumption_data:
            raise ValueError("No hourly consumption data available")
        return sum(hour["cost"] for hour in consumption_data)

    async def get_last_24h_consumption(self) -> float:
        """Get total energy consumption for the last 24 hours.

        Returns:
            Total consumption in kWh for the last 24 hours (sum of hourly consumption)

        Raises:
            ValueError: If no consumption data is available
        """
        consumption_data = await self._fetch_consumption_data("HOURLY", last=24)
        if not consumption_data:
            raise ValueError("No hourly consumption data available")
        return sum(hour["consumption"] for hour in consumption_data)

    async def _fetch_consumption_data(
        self,
        resolution: str,
        last: int,
    ) -> list[ConsumptionData]:
        """Fetch consumption data from Tibber API.

        Args:
            resolution: Time resolution (HOURLY, DAILY, WEEKLY, MONTHLY)
            last: Number of periods to fetch

        Returns:
            List of consumption data dictionaries
        """
        connection = tibber.Tibber(  # type: ignore[attr-defined]
            self._settings.tibber_access_token,
            user_agent=self._user_agent,
        )

        try:
            try:
                await connection.update_info()
                homes = connection.get_homes()
                home = homes[0]

                # Fetch consumption data
                consumption_nodes = await home.fetch_consumption(
                    resolution=resolution,
                    last=last,
                )

                # Convert to our format
                result: list[ConsumptionData] = []
                for node in consumption_nodes:
                    result.append(
                        {
                            "from_time": node.from_time,
                            "to_time": node.to_time,
                            "consumption": node.consumption or 0.0,
                            "cost": node.cost or 0.0,
                            "unit_price": node.unit_price or 0.0,
                            "currency": node.currency or "EUR",
                        }
                    )

                return result
            except Exception as exc:  # pragma: no cover - network issues
                self._logger.error(
                    "tibber_api_request_failed",
                    error=str(exc),
                    error_type=type(exc).__name__,
                    resolution=resolution,
                    last=last,
                )
                raise APIError("Tibber API request failed") from exc
        finally:
            await connection.close_connection()
