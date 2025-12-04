"""Test for this_year calculation in Tibber service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.tibber.service import TibberService
from pytest_mock import MockerFixture


@pytest.mark.asyncio(scope="function")
async def test_this_year_calculation_march_15_10am(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test this_year = completed_months + this_month on March 15, 10am.
    
    Scenario: March 15, 2024 at 10:00 AM
    - Completed months: January (31 days) + February (29 days in 2024)
    - This month (March): 14 completed days + today so far (10 completed hours: 0-9)
    
    Note: this_hour (hour 10, the current incomplete hour) is NOT included in this_year
    because it's incomplete. It's tracked separately as its own period.
    
    Expected: this_year = jan_cost + feb_cost + march_1_to_14_cost + today_0_to_9_cost
    """
    # Arrange - costs for completed months
    jan_cost = 150.0  # January total
    jan_consumption = 600.0
    feb_cost = 140.0  # February total
    feb_consumption = 560.0
    
    # March 1-14 (14 completed days)
    march_completed_days_cost = 70.0  # 14 days * 5.0 per day
    march_completed_days_consumption = 280.0
    
    # Today (March 15) - 10 completed hours (0-9)
    today_hourly_cost = 0.5
    today_hourly_consumption = 2.0
    today_hourly_nodes = []
    for _ in range(10):
        today_hourly_nodes.append({
            "totalCost": today_hourly_cost,
            "consumption": today_hourly_consumption
        })
    today_cost = today_hourly_cost * 10  # 5.0
    today_consumption = today_hourly_consumption * 10  # 20.0
    
    # This hour (current incomplete hour)
    this_hour_cost = 0.25
    this_hour_consumption = 1.0
    
    # Expected this_year calculation (does NOT include this_hour)
    expected_year_cost = (
        jan_cost + feb_cost + march_completed_days_cost + today_cost
    )  # 150 + 140 + 70 + 5.0 = 365.0
    
    expected_year_consumption = (
        jan_consumption + feb_consumption + march_completed_days_consumption +
        today_consumption
    )  # 600 + 560 + 280 + 20 = 1460.0

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(0.30, datetime(2024, 3, 15, 10, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(return_value=None)
    mock_home.get_historic_data = AsyncMock(
        side_effect=[
            [{"totalCost": 0.5, "consumption": 2.0}],  # Last hour
            [],  # Last hour production
            [{"totalCost": 5.0, "consumption": 20.0}],  # Last day
            [],  # Last day production
            [{"totalCost": 0.5, "consumption": 2.0}] * 24,  # Last 24h
            [],  # Last 24h production
            today_hourly_nodes,  # This day hourly (10 hours: 0-9)
            [],  # This day hourly production
            [
                {"totalCost": this_hour_cost, "consumption": this_hour_consumption}
            ],  # This hour
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month (Feb)
            [],  # Last month production
            # For this_year: completed months + this_month
            # Implementation calculates this_year properly
            [{"totalCost": 100.0, "consumption": 500.0}],  # Placeholder
            [],  # This year production
            [
                {"totalCost": 100.0, "consumption": 500.0},
                {"totalCost": 90.0, "consumption": 450.0},
            ],  # Last year
            [
                {"production": 0.0},
                {"production": 0.0},
            ],  # Last year production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            # For this_month calculation (March 1-14)
            [
                {
                    "cost": march_completed_days_cost,
                    "consumption": march_completed_days_consumption,
                }
            ],
            [{"production": 0.0}],
            # For this_year calculation - completed months (Jan, Feb)
            [
                {"cost": jan_cost, "consumption": jan_consumption},  # January
                {"cost": feb_cost, "consumption": feb_consumption},  # February
            ],
            [{"production": 0.0}, {"production": 0.0}],  # Jan, Feb production
        ]
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.time_zone = ZoneInfo("Europe/Berlin")
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        
        # Find this_year cost measurement
        this_year_cost = None
        this_year_consumption = None
        
        for m in measurements:
            if m.measurement == "electricity_costs_euro":
                if m.tags.get("period") == "this_year":
                    this_year_cost = m.fields["cost"]
            elif m.measurement == "electricity_consumption_kwh":
                if m.tags.get("period") == "this_year" and "source" not in m.tags:
                    this_year_consumption = m.fields["consumption"]
        
        # Verify the costs
        assert this_year_cost is not None, "this_year cost not found"
        assert this_year_consumption is not None, "this_year consumption not found"
        
        assert this_year_cost == expected_year_cost, (
            f"this_year cost should be {expected_year_cost} "
            f"(Jan {jan_cost} + Feb {feb_cost} + "
            f"March 1-14 {march_completed_days_cost} + "
            f"today completed hours {today_cost}), "
            f"got {this_year_cost}"
        )
        
        assert this_year_consumption == expected_year_consumption, (
            f"this_year consumption should be {expected_year_consumption}, "
            f"got {this_year_consumption}"
        )
