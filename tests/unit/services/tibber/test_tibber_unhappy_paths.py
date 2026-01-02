"""Unhappy path tests for Tibber service new periods."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.tibber.service import TibberService
from pytest_mock import MockerFixture


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
