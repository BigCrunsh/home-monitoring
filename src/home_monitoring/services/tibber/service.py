"""Tibber service implementation."""

from datetime import UTC, datetime
from typing import TypedDict
from zoneinfo import ZoneInfo

from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.core.mappers.tibber import TibberMapper
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.base import BaseService

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

    async def collect_and_store(self) -> None:  # noqa: PLR0912, PLR0915
        """Collect Tibber price and summary data and store in InfluxDB."""
        self._logger.info("collecting_electricity_data")

        connection = tibber.Tibber(  # type: ignore[attr-defined]
            self._settings.tibber_access_token,
            user_agent=self._user_agent,
            time_zone=ZoneInfo("Europe/Berlin"),
        )

        try:
            # Connect to Tibber and get home
            await connection.update_info()
            self._logger.debug("connected_to_tibber", name=connection.name)

            homes = connection.get_homes()
            home = homes[0]
            await home.fetch_consumption_data()
            await home.update_info()
            self._logger.debug("got_home_data", address=home.address1)

            measurements: list[Measurement] = []

            # Collect current price data
            total, starts_at, rank = home.current_price_data()
            if not starts_at:
                price_timestamp = datetime.now(UTC)
            elif starts_at.tzinfo is None:
                price_timestamp = starts_at.replace(tzinfo=UTC)
            else:
                price_timestamp = starts_at.astimezone(UTC)

            price_data = {
                "total": total,
                "startsAt": starts_at.isoformat() if starts_at else "",
                "rank": rank,
                "currency": "EUR",
                "level": "NORMAL",
                "energy": total * 0.8 if total else 0.0,
                "tax": total * 0.2 if total else 0.0,
            }
            measurements.extend(
                TibberMapper.to_measurements(price_timestamp, price_data)
            )

            # Collect consumption summaries
            summary_timestamp = datetime.now(UTC)

            # Last hour
            try:
                hourly_data = await home.get_historic_data(
                    n_data=1, resolution="HOURLY"
                )
                if hourly_data:
                    node = hourly_data[0]
                    self._logger.debug(
                        "last_hour_data",
                        from_time=node.get("from"),
                        to_time=node.get("to"),
                        cost=node.get("cost"),
                        consumption=node.get("consumption"),
                    )
                    cost = node.get("cost") or 0.0
                    consumption = node.get("consumption") or 0.0
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": cost, "period": "last_hour"},
                        )
                    )
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": consumption,
                                "period": "last_hour",
                            },
                        )
                    )
            except Exception as e:
                self._logger.warning("failed_to_get_last_hour_data", error=str(e))

            # Yesterday
            try:
                daily_data = await home.get_historic_data(
                    n_data=1, resolution="DAILY"
                )
                if daily_data:
                    node = daily_data[0]
                    self._logger.debug(
                        "yesterday_data",
                        from_time=node.get("from"),
                        to_time=node.get("to"),
                        cost=node.get("cost"),
                        total_cost=node.get("totalCost"),
                        consumption=node.get("consumption"),
                        unit_price=node.get("unitPrice"),
                        all_fields=list(node.keys()),
                    )
                    cost = node.get("cost") or 0.0
                    consumption = node.get("consumption") or 0.0
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": cost, "period": "yesterday"},
                        )
                    )
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": consumption,
                                "period": "yesterday",
                            },
                        )
                    )
            except Exception as e:
                self._logger.warning("failed_to_get_yesterday_data", error=str(e))

            # Last 24h
            try:
                hourly_24h_data = await home.get_historic_data(
                    n_data=24, resolution="HOURLY"
                )
                if hourly_24h_data:
                    total_cost = sum(
                        node.get("cost") or 0.0 for node in hourly_24h_data
                    )
                    total_consumption = sum(
                        node.get("consumption") or 0.0 for node in hourly_24h_data
                    )
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": total_cost, "period": "last_24h"},
                        )
                    )
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"consumption": total_consumption, "period": "last_24h"},
                        )
                    )
            except Exception as e:
                self._logger.warning("failed_to_get_last_24h_data", error=str(e))

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

