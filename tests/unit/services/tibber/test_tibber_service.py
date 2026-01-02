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
    mock_consumption_node_hourly = {"totalCost": 0.45, "consumption": 1.5}
    mock_consumption_node_daily = {"totalCost": 7.65, "consumption": 25.5}

    mock_consumption_nodes_24h = []
    for _ in range(24):
        node = {"totalCost": 0.30, "consumption": 1.0}
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
            [mock_consumption_node_daily],  # Last day consumption
            [],  # Last day production (no solar)
            mock_consumption_nodes_24h,  # Last 24h consumption
            [],  # Last 24h production (no solar)
            mock_consumption_nodes_24h[:10],  # This day hourly consumption
            [],  # This day hourly production (no solar)
            [mock_consumption_node_hourly],  # This hour consumption
            [],  # This hour production (no solar)
            [mock_consumption_node_daily],  # Last month consumption
            [],  # Last month production (no solar)
            [
                {"totalCost": 100.0, "consumption": 500.0},
                {"totalCost": 90.0, "consumption": 450.0},
            ],  # Last year (need 2 items)
            [
                {"production": 0.0},
                {"production": 0.0},
            ],  # Last year production (no solar)
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 5.50, "consumption": 20.0}],  # Day 1 for this_month
            [{"production": 0.0}],  # Day 1 production for this_month
            # For this_year: completed months (Jan)
            [{"cost": 10.0, "consumption": 40.0}],  # January
            [{"production": 0.0}],  # January production
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
        # 1 price + 3 last_hour + 3 last_day + 3 this_day +
        # 3 this_month + 3 this_hour + 3 last_month + 3 last_year
        # Note: this_year is not included in basic test (no year data mocked)
        expected_count = 22
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
    mock_consumption_node = {"totalCost": 0.45, "consumption": 1.5}

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
async def test_this_month_equals_last_day_plus_today_on_day_2(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test that on day 2, this_month cost = last_day cost + this_day cost."""
    # Arrange
    last_day_cost = 5.50
    last_day_consumption = 20.0

    # Today's hourly data (10 hours so far, simulating 10am on day 2)
    today_hourly_cost = 0.35
    today_hourly_consumption = 1.2
    today_hourly_nodes = []
    for _ in range(10):
        today_hourly_nodes.append(
            {"totalCost": today_hourly_cost, "consumption": today_hourly_consumption}
        )

    expected_today_cost = today_hourly_cost * 10  # 3.50
    expected_month_cost = last_day_cost + expected_today_cost  # 5.50 + 3.50 = 9.00

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
            [
                {"totalCost": last_day_cost, "consumption": last_day_consumption}
            ],  # Last day
            [],  # Last day production
            today_hourly_nodes,  # This day hourly (10 hours) - moved up
            [],  # This day hourly production
            [{"totalCost": 0.35, "consumption": 1.2}],  # This hour
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month
            [],  # Last month production
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
            [{"cost": last_day_cost, "consumption": last_day_consumption}],  # Day 1
            [{"production": 0.0}],  # Day 1 production
            # For this_year: completed months (Jan)
            [{"cost": 10.0, "consumption": 40.0}],  # January
            [{"production": 0.0}],  # January production
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

        assert (
            this_day_cost == expected_today_cost
        ), f"this_day cost should be {expected_today_cost}, got {this_day_cost}"
        assert this_month_cost == expected_month_cost, (
            f"this_month cost should be {expected_month_cost} "
            f"(last_day {last_day_cost} + today {expected_today_cost}), "
            f"got {this_month_cost}"
        )


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
        today_hourly_nodes.append(
            {"totalCost": today_hourly_cost, "consumption": today_hourly_consumption}
        )
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
        jan_consumption
        + feb_consumption
        + march_completed_days_consumption
        + today_consumption
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
            today_hourly_nodes,  # This day hourly (10 hours: 0-9) - moved up
            [],  # This day hourly production
            [
                {"totalCost": this_hour_cost, "consumption": this_hour_consumption}
            ],  # This hour
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month (Feb)
            [],  # Last month production
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


@pytest.mark.asyncio(scope="function")
async def test_this_hour_missing_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Unhappy path: this_hour data is missing (None values)."""
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
            [{"totalCost": 0.5, "consumption": 2.0}] * 10,  # This day (moved up)
            [],  # This day production
            [{"totalCost": None, "consumption": None}],  # This hour - MISSING DATA
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month
            [],  # Last month production
            [
                {"totalCost": 100.0, "consumption": 500.0},
                {"totalCost": 90.0, "consumption": 450.0},
            ],  # Last year
            [{"production": 0.0}, {"production": 0.0}],  # Last year production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 70.0, "consumption": 280.0}],  # This month completed days
            [{"production": 0.0}],
            [
                {"cost": 150.0, "consumption": 600.0},
                {"cost": 140.0, "consumption": 560.0},
            ],  # This year completed months
            [{"production": 0.0}, {"production": 0.0}],
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

        # Assert - should still succeed, just without this_hour data
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]

        # Verify this_hour measurements are NOT present
        this_hour_measurements = [
            m for m in measurements if m.tags.get("period") == "this_hour"
        ]
        assert (
            len(this_hour_measurements) == 0
        ), "this_hour should be skipped when data is missing"


@pytest.mark.asyncio(scope="function")
async def test_last_month_missing_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Unhappy path: last_month data is missing (None values)."""
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
            [{"totalCost": 0.5, "consumption": 2.0}] * 10,  # This day (moved up)
            [],  # This day production
            [{"totalCost": 0.25, "consumption": 1.0}],  # This hour
            [],  # This hour production
            [{"totalCost": None, "consumption": 200.0}],  # Last month - MISSING COST
            [],  # Last month production
            [
                {"totalCost": 100.0, "consumption": 500.0},
                {"totalCost": 90.0, "consumption": 450.0},
            ],  # Last year
            [{"production": 0.0}, {"production": 0.0}],  # Last year production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 70.0, "consumption": 280.0}],  # This month completed days
            [{"production": 0.0}],
            [
                {"cost": 150.0, "consumption": 600.0},
                {"cost": 140.0, "consumption": 560.0},
            ],  # This year completed months
            [{"production": 0.0}, {"production": 0.0}],
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

        # Verify last_month measurements are NOT present
        last_month_measurements = [
            m for m in measurements if m.tags.get("period") == "last_month"
        ]
        assert (
            len(last_month_measurements) == 0
        ), "last_month should be skipped when data is incomplete"


@pytest.mark.asyncio(scope="function")
async def test_last_year_insufficient_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Unhappy path: last_year has insufficient data (only 1 year instead of 2)."""
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
            [{"totalCost": 0.5, "consumption": 2.0}] * 10,  # This day (moved up)
            [],  # This day production
            [{"totalCost": 0.25, "consumption": 1.0}],  # This hour
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month
            [],  # Last month production
            [{"totalCost": 100.0, "consumption": 500.0}],  # Last year - ONLY 1 ITEM
            [{"production": 0.0}],  # Last year production - ONLY 1 ITEM
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 70.0, "consumption": 280.0}],  # This month completed days
            [{"production": 0.0}],
            [
                {"cost": 150.0, "consumption": 600.0},
                {"cost": 140.0, "consumption": 560.0},
            ],  # This year completed months
            [{"production": 0.0}, {"production": 0.0}],
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

        # Verify last_year measurements are NOT present
        last_year_measurements = [
            m for m in measurements if m.tags.get("period") == "last_year"
        ]
        assert (
            len(last_year_measurements) == 0
        ), "last_year should be skipped when insufficient data"


@pytest.mark.asyncio(scope="function")
async def test_this_year_incomplete_months(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Unhappy path: this_year has incomplete month data (None in completed months)."""
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
            [{"totalCost": 0.5, "consumption": 2.0}] * 10,  # This day (moved up)
            [],  # This day production
            [{"totalCost": 0.25, "consumption": 1.0}],  # This hour
            [],  # This hour production
            [{"totalCost": 50.0, "consumption": 200.0}],  # Last month
            [],  # Last month production
            [
                {"totalCost": 100.0, "consumption": 500.0},
                {"totalCost": 90.0, "consumption": 450.0},
            ],  # Last year
            [{"production": 0.0}, {"production": 0.0}],  # Last year production
        ]
    )
    mock_home.get_historic_data_date = AsyncMock(
        side_effect=[
            [{"cost": 70.0, "consumption": 280.0}],  # This month completed days
            [{"production": 0.0}],
            [
                {"cost": 150.0, "consumption": 600.0},
                {"cost": None, "consumption": 560.0},  # February - MISSING COST
            ],  # This year completed months - INCOMPLETE
            [{"production": 0.0}, {"production": 0.0}],
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

        # Verify this_year measurements are NOT present
        this_year_measurements = [
            m for m in measurements if m.tags.get("period") == "this_year"
        ]
        assert (
            len(this_year_measurements) == 0
        ), "this_year should be skipped when month data is incomplete"
