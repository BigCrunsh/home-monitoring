"""Unit tests for Tibber service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.tibber.service import TibberService
from pytest_mock import MockerFixture


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection and storage."""
    # Arrange
    mock_consumption_node_hourly = {"cost": 0.45, "consumption": 1.5}
    mock_consumption_node_daily = {"cost": 7.65, "consumption": 25.5}

    mock_consumption_nodes_24h = []
    for _ in range(24):
        node = {"cost": 0.30, "consumption": 1.0}
        mock_consumption_nodes_24h.append(node)

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(return_value=None)
    mock_home.get_historic_data = AsyncMock(
        side_effect=[
            [mock_consumption_node_hourly],  # Last hour consumption
            [],  # Last hour production (no solar)
            [mock_consumption_node_daily],  # Yesterday consumption
            [],  # Yesterday production (no solar)
            mock_consumption_nodes_24h,  # Last 24h consumption
            [],  # Last 24h production (no solar)
            mock_consumption_nodes_24h[:10],  # This day hourly consumption
            [],  # This day hourly production (no solar)
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 5.50, "consumption": 20.0}],  # Yesterday (day 1)
            [{"production": 0.0}],  # Yesterday production
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
        # 1 price + 3 last_hour + 3 yesterday + 3 last_24h + 3 this_day + 3 this_month
        expected_count = 16
        assert len(measurements) == expected_count


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of API error."""
    # Arrange
    mock_connection = AsyncMock()
    mock_connection.update_info.side_effect = Exception("API Error")

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(APIError, match="Tibber API request failed"):
            await service.collect_and_store()

        assert not mock_influxdb.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of database error."""
    # Arrange
    mock_consumption_node = {"cost": 0.45, "consumption": 1.5}

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(return_value=None)
    mock_home.get_historic_data = AsyncMock(
        side_effect=[
            [mock_consumption_node],  # Hourly consumption
            [],  # Hourly production
            [mock_consumption_node],  # Daily consumption
            [],  # Daily production
            [mock_consumption_node] * 24,  # 24h consumption
            [],  # 24h production
            [mock_consumption_node] * 10,  # This day hourly consumption
            [],  # This day hourly production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [],  # This month completed days
            [],  # This month completed days production
        ]
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.time_zone = ZoneInfo("Europe/Berlin")
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)
        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(APIError, match="Tibber API request failed"):
            await service.collect_and_store()


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_partial_consumption_failure(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test that price data is still collected even if some consumption data fails."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )
    # All consumption data calls fail
    mock_home.fetch_consumption_data = AsyncMock(return_value=None)
    mock_home.get_historic_data = AsyncMock(
        side_effect=[
            Exception("Hourly consumption unavailable"),
            Exception("Hourly production unavailable"),
            Exception("Daily consumption unavailable"),
            Exception("Daily production unavailable"),
            Exception("24h consumption unavailable"),
            Exception("24h production unavailable"),
            Exception("This day hourly consumption unavailable"),
            Exception("This day hourly production unavailable"),
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            Exception("This month completed days unavailable"),
            Exception("This month completed days production unavailable"),
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

        # Assert - should still store price measurement
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 1  # Only price measurement
        assert measurements[0].measurement == "electricity_prices_euro"


@pytest.mark.asyncio(scope="function")
async def test_this_month_equals_yesterday_plus_today_on_day_2(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test that on day 2, this_month cost = yesterday cost + this_day cost."""
    # Arrange
    yesterday_cost = 5.50
    yesterday_consumption = 20.0
    
    # Today's hourly data (10 hours so far, simulating 10am on day 2)
    today_hourly_cost = 0.35
    today_hourly_consumption = 1.2
    today_hourly_nodes = []
    for _ in range(10):
        today_hourly_nodes.append({
            "totalCost": today_hourly_cost,
            "consumption": today_hourly_consumption
        })
    
    expected_today_cost = today_hourly_cost * 10  # 3.50
    expected_month_cost = yesterday_cost + expected_today_cost  # 5.50 + 3.50 = 9.00

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(0.30, datetime(2024, 2, 2, 10, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(return_value=None)
    mock_home.get_historic_data = AsyncMock(
        side_effect=[
            [{"totalCost": 0.35, "consumption": 1.2}],  # Last hour
            [],  # Last hour production
            [{"totalCost": yesterday_cost, "consumption": yesterday_consumption}],  # Yesterday
            [],  # Yesterday production
            [{"totalCost": 0.30, "consumption": 1.0}] * 24,  # Last 24h
            [],  # Last 24h production
            today_hourly_nodes,  # This day hourly (10 hours)
            [],  # This day hourly production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": yesterday_cost, "consumption": yesterday_consumption}],  # Day 1
            [{"production": 0.0}],  # Day 1 production
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
        
        # Find this_day and this_month cost measurements
        this_day_cost = None
        this_month_cost = None
        
        for m in measurements:
            if m.measurement == "electricity_costs_euro":
                if m.tags.get("period") == "this_day":
                    this_day_cost = m.fields["cost"]
                elif m.tags.get("period") == "this_month":
                    this_month_cost = m.fields["cost"]
        
        # Verify the costs
        assert this_day_cost is not None, "this_day cost not found"
        assert this_month_cost is not None, "this_month cost not found"
        
        assert this_day_cost == expected_today_cost, (
            f"this_day cost should be {expected_today_cost}, got {this_day_cost}"
        )
        assert this_month_cost == expected_month_cost, (
            f"this_month cost should be {expected_month_cost} "
            f"(yesterday {yesterday_cost} + today {expected_today_cost}), "
            f"got {this_month_cost}"
        )
