"""Tibber service implementation - orchestrates data collection."""

from datetime import UTC, datetime
from typing import TypedDict

from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.base import BaseService
from home_monitoring.services.tibber import aggregation, collection

import tibber


class ConsumptionData(TypedDict):
    """Type definition for consumption data."""

    from_time: datetime
    to_time: datetime
    consumption: float
    cost: float
    unit_price: float
    currency: str


class TibberService(BaseService):
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
        super().__init__(settings=settings, repository=repository)
        self._user_agent = user_agent

    async def collect_and_store(self) -> None:
        """Collect Tibber price and summary data and store in InfluxDB."""
        self._logger.info("collecting_electricity_data")

        try:
            connection = tibber.Tibber(
                access_token=self._settings.tibber_access_token,
                user_agent=self._user_agent,
            )
            await connection.update_info()

            self._logger.debug("connected_to_tibber", name=connection.name)

            homes = connection.get_homes()
            if not homes:
                self._logger.warning("no_homes_found")
                return

            home = homes[0]
            self._logger.debug("got_home_data", address=home.address1)

            # Update price info before accessing price data
            await home.update_price_info()

            summary_timestamp = datetime.now(UTC)
            measurements = []

            # Get current time from price data (for aggregation calculations)
            try:
                _, price_timestamp, _ = home.current_price_data()
                current_time = price_timestamp
            except Exception:
                current_time = None

            # Collect price data
            price_measurements = await collection.collect_price_data(
                home, summary_timestamp
            )
            measurements.extend(price_measurements)

            # Collect individual period data
            last_hour = await collection.collect_last_hour_data(
                home, summary_timestamp
            )
            measurements.extend(last_hour)

            last_day = await collection.collect_last_day_data(home, summary_timestamp)
            measurements.extend(last_day)

            last_24h = await collection.collect_last_24h_data(home, summary_timestamp)
            measurements.extend(last_24h)

            # Collect aggregated period data (this_day, this_month, this_year)
            # Note: Must be called before this_hour to maintain test mock order
            this_day_measurements, day_cost, day_consumption, day_production = (
                await aggregation.aggregate_this_day_data(
                    home, connection, summary_timestamp, current_time
                )
            )
            measurements.extend(this_day_measurements)

            this_month_measurements, month_cost, month_consumption, month_production = (
                await aggregation.aggregate_this_month_data(
                    home,
                    connection,
                    summary_timestamp,
                    day_cost,
                    day_consumption,
                    day_production,
                    current_time,
                )
            )
            measurements.extend(this_month_measurements)

            this_year_measurements = await aggregation.aggregate_this_year_data(
                home,
                connection,
                summary_timestamp,
                month_cost,
                month_consumption,
                month_production,
                current_time,
            )
            measurements.extend(this_year_measurements)

            # Collect remaining simple periods after aggregations
            this_hour = await collection.collect_this_hour_data(
                home, summary_timestamp
            )
            measurements.extend(this_hour)

            last_month = await collection.collect_last_month_data(
                home, summary_timestamp
            )
            measurements.extend(last_month)

            last_year = await collection.collect_last_year_data(
                home, summary_timestamp
            )
            measurements.extend(last_year)

            # Store all measurements
            if not measurements:
                self._logger.warning("no_tibber_measurements_to_store")
                return

            await self._db.write_measurements(measurements)
            self._logger.info(
                "tibber_data_stored",
                point_count=len(measurements),
            )

        except Exception as exc:
            self._logger.error(
                "tibber_api_request_failed",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise APIError("Tibber API request failed") from exc
        finally:
            await connection.close_connection()
