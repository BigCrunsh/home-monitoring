"""Tibber data collection functions for all simple periods.

This module contains all simple data collection functions that make
direct API calls without complex aggregation logic.
"""

from datetime import datetime

import structlog

from home_monitoring.core.mappers.tibber import TibberMapper
from home_monitoring.models.base import Measurement


logger = structlog.get_logger()


async def collect_price_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect current electricity price data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of price measurements
    """
    measurements = []
    
    try:
        total, _, rank = home.current_price_data()
        measurements.extend(
            TibberMapper.to_measurements(
                summary_timestamp,
                {"total": total, "rank": rank},
            )
        )
    except Exception as e:
        logger.warning("failed_to_get_price_data", error=str(e))
    
    return measurements


async def collect_last_hour_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect last completed hour consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for last hour
    """
    measurements = []
    
    try:
        hourly_data = await home.get_historic_data(n_data=1, resolution="HOURLY")
        hourly_production = await home.get_historic_data(
            n_data=1, resolution="HOURLY", production=True
        )
        
        if hourly_data:
            node = hourly_data[0]
            cost = node.get("totalCost")
            consumption = node.get("consumption")
            
            if cost is None or consumption is None:
                logger.debug(
                    "last_hour_data_missing",
                    has_cost=cost is not None,
                    has_consumption=consumption is not None,
                )
            else:
                production = 0.0
                if hourly_production:
                    prod_node = hourly_production[0]
                    prod_value = prod_node.get("production")
                    if prod_value is not None:
                        production = prod_value
                
                logger.debug(
                    "last_hour_production_raw",
                    production_list=hourly_production,
                    has_data=bool(hourly_production),
                )
                
                grid_consumption = max(0.0, consumption - production)
                self_consumption = min(consumption, production)
                
                logger.debug(
                    "last_hour_data",
                    cost=cost,
                    consumption=consumption,
                    production=production,
                    grid_consumption=grid_consumption,
                    self_consumption=self_consumption,
                )
                
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": cost, "period": "last_hour"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": consumption, "period": "last_hour"},
                    )
                )
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
        logger.warning("failed_to_get_last_hour_data", error=str(e))
    
    return measurements


async def collect_last_day_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect last completed day (yesterday) consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for last day
    """
    measurements = []
    
    try:
        daily_data = await home.get_historic_data(n_data=1, resolution="DAILY")
        daily_production = await home.get_historic_data(
            n_data=1, resolution="DAILY", production=True
        )
        
        if daily_data:
            node = daily_data[0]
            cost = node.get("totalCost")
            consumption = node.get("consumption")
            
            if cost is None or consumption is None:
                logger.debug(
                    "last_day_data_missing",
                    has_cost=cost is not None,
                    has_consumption=consumption is not None,
                )
            else:
                production = 0.0
                if daily_production:
                    prod_node = daily_production[0]
                    prod_value = prod_node.get("production")
                    if prod_value is not None:
                        production = prod_value
                
                grid_consumption = max(0.0, consumption - production)
                
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": cost, "period": "last_day"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": consumption, "period": "last_day"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": grid_consumption,
                            "period": "last_day",
                            "source": "grid",
                        },
                    )
                )
                if production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": production,
                                "period": "last_day",
                                "source": "solar",
                            },
                        )
                    )
    except Exception as e:
        logger.warning("failed_to_get_last_day_data", error=str(e))
    
    return measurements


async def collect_last_24h_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect last 24 hours rolling consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for last 24h
    """
    measurements = []
    
    try:
        hourly_24h_data = await home.get_historic_data(
            n_data=24, resolution="HOURLY"
        )
        hourly_24h_production = await home.get_historic_data(
            n_data=24, resolution="HOURLY", production=True
        )
        
        if hourly_24h_data:
            costs = [node.get("totalCost") for node in hourly_24h_data]
            consumptions = [node.get("consumption") for node in hourly_24h_data]
            
            if None in costs or None in consumptions:
                logger.debug(
                    "last_24h_data_incomplete",
                    missing_costs=costs.count(None),
                    missing_consumptions=consumptions.count(None),
                    total_hours=len(hourly_24h_data),
                )
            else:
                total_cost = sum(costs)
                total_consumption = sum(consumptions)
                
                total_production = 0.0
                if hourly_24h_production:
                    productions = [
                        node.get("production") for node in hourly_24h_production
                    ]
                    total_production = sum(
                        p if p is not None else 0.0 for p in productions
                    )
                
                grid_consumption = max(0.0, total_consumption - total_production)
                
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
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": grid_consumption,
                            "period": "last_24h",
                            "source": "grid",
                        },
                    )
                )
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
        logger.warning("failed_to_get_last_24h_data", error=str(e))
    
    return measurements


async def collect_this_hour_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect current incomplete hour consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for this hour
    """
    measurements = []
    
    try:
        this_hour_data = await home.get_historic_data(n_data=1, resolution="HOURLY")
        this_hour_production = await home.get_historic_data(
            n_data=1, resolution="HOURLY", production=True
        )
        
        if this_hour_data:
            node = this_hour_data[0]
            cost = node.get("totalCost")
            consumption = node.get("consumption")
            
            if cost is not None and consumption is not None:
                production = 0.0
                if this_hour_production:
                    prod_node = this_hour_production[0]
                    prod_value = prod_node.get("production")
                    if prod_value is not None:
                        production = prod_value
                
                grid_consumption = max(0.0, consumption - production)
                
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": cost, "period": "this_hour"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": consumption, "period": "this_hour"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": grid_consumption,
                            "period": "this_hour",
                            "source": "grid",
                        },
                    )
                )
                if production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": production,
                                "period": "this_hour",
                                "source": "solar",
                            },
                        )
                    )
    except Exception as e:
        logger.warning("failed_to_get_this_hour_data", error=str(e))
    
    return measurements


async def collect_last_month_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect last completed month consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for last month
    """
    measurements = []
    
    try:
        monthly_data = await home.get_historic_data(n_data=1, resolution="MONTHLY")
        monthly_production = await home.get_historic_data(
            n_data=1, resolution="MONTHLY", production=True
        )
        
        if monthly_data:
            node = monthly_data[0]
            cost = node.get("totalCost")
            consumption = node.get("consumption")
            
            if cost is None or consumption is None:
                logger.debug(
                    "last_month_data_missing",
                    has_cost=cost is not None,
                    has_consumption=consumption is not None,
                )
            else:
                production = 0.0
                if monthly_production:
                    prod_node = monthly_production[0]
                    prod_value = prod_node.get("production")
                    if prod_value is not None:
                        production = prod_value
                
                grid_consumption = max(0.0, consumption - production)
                
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": cost, "period": "last_month"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": consumption, "period": "last_month"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": grid_consumption,
                            "period": "last_month",
                            "source": "grid",
                        },
                    )
                )
                if production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": production,
                                "period": "last_month",
                                "source": "solar",
                            },
                        )
                    )
    except Exception as e:
        logger.warning("failed_to_get_last_month_data", error=str(e))
    
    return measurements


async def collect_last_year_data(
    home, summary_timestamp: datetime
) -> list[Measurement]:
    """Collect last completed year consumption data.
    
    Args:
        home: Tibber home object
        summary_timestamp: Timestamp for measurements
        
    Returns:
        List of measurements for last year
    """
    measurements = []
    
    try:
        last_year_data = await home.get_historic_data(n_data=2, resolution="ANNUAL")
        last_year_production = await home.get_historic_data(
            n_data=2, resolution="ANNUAL", production=True
        )
        
        if last_year_data and len(last_year_data) > 1:
            node = last_year_data[1]
            cost = node.get("totalCost")
            consumption = node.get("consumption")
            
            if cost is None or consumption is None:
                logger.debug(
                    "last_year_data_missing",
                    has_cost=cost is not None,
                    has_consumption=consumption is not None,
                )
            else:
                production = 0.0
                if last_year_production and len(last_year_production) > 1:
                    prod_node = last_year_production[1]
                    prod_value = prod_node.get("production")
                    if prod_value is not None:
                        production = prod_value
                
                grid_consumption = max(0.0, consumption - production)
                
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"cost": cost, "period": "last_year"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {"consumption": consumption, "period": "last_year"},
                    )
                )
                measurements.extend(
                    TibberMapper.to_measurements(
                        summary_timestamp,
                        {
                            "consumption": grid_consumption,
                            "period": "last_year",
                            "source": "grid",
                        },
                    )
                )
                if production > 0:
                    measurements.extend(
                        TibberMapper.to_measurements(
                            summary_timestamp,
                            {
                                "consumption": production,
                                "period": "last_year",
                                "source": "solar",
                            },
                        )
                    )
    except Exception as e:
        logger.warning("failed_to_get_last_year_data", error=str(e))
    
    return measurements
