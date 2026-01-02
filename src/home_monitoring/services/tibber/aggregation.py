"""Tibber data aggregation functions for period calculations."""

from datetime import datetime

import structlog
from home_monitoring.core.mappers.tibber import TibberMapper
from home_monitoring.models.base import Measurement

logger = structlog.get_logger()


async def aggregate_this_day_data(
    home, connection, summary_timestamp: datetime, now: datetime | None = None
) -> tuple[list[Measurement], float | None, float | None, float | None]:
    """Aggregate this day (today so far) consumption data.

    Calculates: sum of completed hours (0 to current_hour-1)

    Args:
        home: Tibber home object
        connection: Tibber connection with timezone info
        summary_timestamp: Timestamp for measurements
        now: Current datetime (if None, uses actual current time)

    Returns:
        Tuple of (measurements, day_cost, day_consumption, day_production)
    """
    measurements = []
    day_cost = None
    day_consumption = None
    day_production = None

    try:
        from datetime import datetime as dt

        if now is None:
            now = dt.now(connection.time_zone)
        current_hour = now.hour

        # Fetch all completed hours today (0 to current_hour)
        today_hourly = await home.get_historic_data(
            n_data=current_hour, resolution="HOURLY"
        )
        today_hourly_production = await home.get_historic_data(
            n_data=current_hour, resolution="HOURLY", production=True
        )

        if today_hourly:
            costs = [node.get("totalCost") for node in today_hourly]
            consumptions = [node.get("consumption") for node in today_hourly]

            if None in costs or None in consumptions:
                logger.debug(
                    "this_day_data_incomplete",
                    missing_costs=costs.count(None),
                    missing_consumptions=consumptions.count(None),
                    total_hours=len(today_hourly),
                )
            else:
                day_cost = sum(costs)
                day_consumption = sum(consumptions)
                day_production = 0.0

                if today_hourly_production:
                    productions = [
                        node.get("production") for node in today_hourly_production
                    ]
                    day_production = sum(
                        p if p is not None else 0.0 for p in productions
                    )

                day_grid_consumption = max(0.0, day_consumption - day_production)

                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": day_cost, "period": "this_day"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": day_consumption, "period": "this_day"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": day_grid_consumption,
                            "period": "this_day",
                            "source": "grid",
                        },
                    )
                )
                if day_production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": day_production,
                                "period": "this_day",
                                "source": "solar",
                            },
                        )
                    )
    except Exception as e:
        logger.warning("failed_to_get_this_day_data", error=str(e))
        day_cost = None
        day_consumption = None
        day_production = None

    return measurements, day_cost, day_consumption, day_production


async def aggregate_this_month_data(
    home,
    connection,
    summary_timestamp: datetime,
    day_cost: float | None,
    day_consumption: float | None,
    day_production: float | None,
    now: datetime | None = None,
) -> tuple[list[Measurement], float | None, float | None, float | None]:
    """Aggregate this month (month so far) consumption data.

    Calculates: sum of completed days + this_day

    Args:
        home: Tibber home object
        connection: Tibber connection with timezone info
        summary_timestamp: Timestamp for measurements
        day_cost: Cost for this_day
        day_consumption: Consumption for this_day
        day_production: Production for this_day
        now: Current datetime (if None, uses actual current time)

    Returns:
        Tuple of (measurements, month_cost, month_consumption, month_production)
    """
    measurements = []
    month_cost = None
    month_consumption = None
    month_production = None

    if day_cost is not None:
        try:
            from datetime import datetime as dt

            if now is None:
                now = dt.now(connection.time_zone)
            first_of_month = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            days_completed = now.day - 1

            month_cost = day_cost
            month_consumption = day_consumption
            month_production = day_production

            logger.debug(
                "this_month_calculation",
                current_day=now.day,
                days_completed=days_completed,
                day_cost=day_cost,
                initial_month_cost=month_cost,
            )

            if days_completed > 0:
                monthly_data = await home.get_historic_data_date(
                    date_from=first_of_month,
                    n_data=days_completed,
                    resolution="DAILY",
                )
                monthly_production = await home.get_historic_data_date(
                    date_from=first_of_month,
                    n_data=days_completed,
                    resolution="DAILY",
                    production=True,
                )

                if monthly_data:
                    costs = [node.get("cost") for node in monthly_data]
                    consumptions = [node.get("consumption") for node in monthly_data]

                    if None in costs or None in consumptions:
                        logger.debug(
                            "this_month_completed_days_incomplete",
                            missing_costs=costs.count(None),
                            missing_consumptions=consumptions.count(None),
                            total_days=len(monthly_data),
                        )
                        month_cost = None
                        month_consumption = None
                    else:
                        completed_days_cost = sum(costs)
                        completed_days_consumption = sum(consumptions)
                        month_cost += completed_days_cost
                        month_consumption += completed_days_consumption

                        logger.debug(
                            "this_month_completed_days",
                            num_days=len(monthly_data),
                            completed_days_cost=completed_days_cost,
                            completed_days_consumption=completed_days_consumption,
                            total_month_cost=month_cost,
                            total_month_consumption=month_consumption,
                        )

                if monthly_production:
                    productions = [
                        node.get("production") for node in monthly_production
                    ]
                    month_production += sum(
                        p if p is not None else 0.0 for p in productions
                    )

            if month_cost is not None and month_consumption is not None:
                month_grid_consumption = max(0.0, month_consumption - month_production)

                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": month_cost, "period": "this_month"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": month_consumption, "period": "this_month"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": month_grid_consumption,
                            "period": "this_month",
                            "source": "grid",
                        },
                    )
                )
                if month_production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": month_production,
                                "period": "this_month",
                                "source": "solar",
                            },
                        )
                    )
        except Exception as e:
            logger.warning("failed_to_get_this_month_data", error=str(e))

    return measurements, month_cost, month_consumption, month_production


async def aggregate_this_year_data(
    home,
    connection,
    summary_timestamp: datetime,
    month_cost: float | None,
    month_consumption: float | None,
    month_production: float | None,
    now: datetime | None = None,
) -> list[Measurement]:
    """Aggregate this year (year so far) consumption data.

    Calculates: sum of completed months + this_month

    Args:
        home: Tibber home object
        connection: Tibber connection with timezone info
        summary_timestamp: Timestamp for measurements
        month_cost: Cost for this_month
        month_consumption: Consumption for this_month
        month_production: Production for this_month
        now: Current datetime (if None, uses actual current time)

    Returns:
        List of measurements for this_year
    """
    measurements = []

    if month_cost is not None:
        try:
            from datetime import datetime as dt

            if now is None:
                now = dt.now(connection.time_zone)
            first_of_year = now.replace(
                month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )
            months_completed = now.month - 1

            year_cost = month_cost
            year_consumption = month_consumption
            year_production = month_production

            logger.debug(
                "this_year_calculation",
                current_month=now.month,
                months_completed=months_completed,
                month_cost=month_cost,
                initial_year_cost=year_cost,
            )

            if months_completed > 0:
                yearly_data = await home.get_historic_data_date(
                    date_from=first_of_year,
                    n_data=months_completed,
                    resolution="MONTHLY",
                )
                yearly_production = await home.get_historic_data_date(
                    date_from=first_of_year,
                    n_data=months_completed,
                    resolution="MONTHLY",
                    production=True,
                )

                if yearly_data:
                    costs = [node.get("cost") for node in yearly_data]
                    consumptions = [node.get("consumption") for node in yearly_data]

                    if None in costs or None in consumptions:
                        logger.debug(
                            "this_year_completed_months_incomplete",
                            missing_costs=costs.count(None),
                            missing_consumptions=consumptions.count(None),
                            total_months=len(yearly_data),
                        )
                        year_cost = None
                        year_consumption = None
                    else:
                        completed_months_cost = sum(costs)
                        completed_months_consumption = sum(consumptions)
                        year_cost += completed_months_cost
                        year_consumption += completed_months_consumption

                        logger.debug(
                            "this_year_completed_months",
                            num_months=len(yearly_data),
                            completed_months_cost=completed_months_cost,
                            completed_months_consumption=completed_months_consumption,
                            total_year_cost=year_cost,
                            total_year_consumption=year_consumption,
                        )

                if yearly_production:
                    productions = [node.get("production") for node in yearly_production]
                    year_production += sum(
                        p if p is not None else 0.0 for p in productions
                    )

            if year_cost is not None and year_consumption is not None:
                year_grid_consumption = max(0.0, year_consumption - year_production)

                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": year_cost, "period": "this_year"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": year_consumption, "period": "this_year"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": year_grid_consumption,
                            "period": "this_year",
                            "source": "grid",
                        },
                    )
                )
                if year_production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": year_production,
                                "period": "this_year",
                                "source": "solar",
                            },
                        )
                    )
        except Exception as e:
            logger.warning("failed_to_get_this_year_data", error=str(e))

    return measurements
