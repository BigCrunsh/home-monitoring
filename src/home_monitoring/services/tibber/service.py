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
                hourly_production = await home.get_historic_data(
                    n_data=1, resolution="HOURLY", production=True
                )
                if hourly_data:
                    node = hourly_data[0]
                    cost = node.get("totalCost") or 0.0
                    consumption = node.get("consumption") or 0.0
                    
                    production = 0.0
                    if hourly_production:
                        prod_node = hourly_production[0]
                        production = prod_node.get("production") or 0.0
                        self._logger.debug(
                            "last_hour_production_raw",
                            has_data=bool(hourly_production),
                            production_value=prod_node.get("production"),
                            all_fields=list(prod_node.keys()) if prod_node else [],
                        )
                    else:
                        self._logger.debug(
                            "last_hour_production_raw",
                            has_data=False,
                            production_list=hourly_production,
                        )
                    
                    grid_consumption = max(0.0, consumption - production)
                    self_consumption = min(consumption, production)
                    
                    self._logger.debug(
                        "last_hour_data",
                        consumption=consumption,
                        production=production,
                        grid_consumption=grid_consumption,
                        self_consumption=self_consumption,
                        cost=cost,
                    )
                    
                    # Store cost (only for grid consumption)
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": cost, "period": "last_hour"},
                        )
                    )
                    # Store total consumption
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"consumption": consumption, "period": "last_hour"},
                        )
                    )
                    # Store grid consumption (what you pay for)
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": grid_consumption,
                                "period": "last_hour",
                                "source": "grid",
                            },
                        )
                    )
                    # Store solar production
                    if production > 0:
                        measurements.extend(
                            TibberMapper.to_measurements(
                                summary_timestamp,
                                {
                                    "consumption": production,
                                    "period": "last_hour",
                                    "source": "solar",
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
                daily_production = await home.get_historic_data(
                    n_data=1, resolution="DAILY", production=True
                )
                if daily_data:
                    node = daily_data[0]
                    cost = node.get("totalCost") or 0.0
                    consumption = node.get("consumption") or 0.0
                    
                    production = 0.0
                    if daily_production:
                        prod_node = daily_production[0]
                        production = prod_node.get("production") or 0.0
                    
                    grid_consumption = max(0.0, consumption - production)
                    
                    # Store cost
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": cost, "period": "yesterday"},
                        )
                    )
                    # Store total consumption
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"consumption": consumption, "period": "yesterday"},
                        )
                    )
                    # Store grid consumption
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": grid_consumption,
                                "period": "yesterday",
                                "source": "grid",
                            },
                        )
                    )
                    # Store solar production
                    if production > 0:
                        measurements.extend(
                            TibberMapper.to_measurements(
                                summary_timestamp,
                                {
                                    "consumption": production,
                                    "period": "yesterday",
                                    "source": "solar",
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
                hourly_24h_production = await home.get_historic_data(
                    n_data=24, resolution="HOURLY", production=True
                )
                if hourly_24h_data:
                    total_cost = sum(
                        node.get("totalCost") or 0.0 for node in hourly_24h_data
                    )
                    total_consumption = sum(
                        node.get("consumption") or 0.0 for node in hourly_24h_data
                    )
                    total_production = 0.0
                    if hourly_24h_production:
                        total_production = sum(
                            node.get("production") or 0.0
                            for node in hourly_24h_production
                        )
                    
                    total_grid_consumption = max(
                        0.0, total_consumption - total_production
                    )
                    
                    # Store cost
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"cost": total_cost, "period": "last_24h"},
                        )
                    )
                    # Store total consumption
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {"consumption": total_consumption, "period": "last_24h"},
                        )
                    )
                    # Store grid consumption
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": total_grid_consumption,
                                "period": "last_24h",
                                "source": "grid",
                            },
                        )
                    )
                    # Store solar production
                    if total_production > 0:
                        measurements.extend(
                            TibberMapper.to_measurements(
                                summary_timestamp,
                                {
                                    "consumption": total_production,
                                    "period": "last_24h",
                                    "source": "solar",
                                },
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

