"""Unit tests for Tibber service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from home_monitoring.config import Settings
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
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 1
        measurement = measurements[0]
        assert measurement.measurement == "electricity_prices_euro"
        assert measurement.tags == {}
        assert measurement.timestamp == datetime(2024, 2, 16, 20, 0, 0)
        assert measurement.fields == {"total": 1.234, "rank": 0.5}


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
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="API Error"):
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
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service and set up database error
        service = TibberService(settings=mock_settings, repository=mock_influxdb)
        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store()


@pytest.mark.asyncio(scope="function")
async def test_current_price_data_returns_tuple(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test that current_price_data returns tuple directly (not coroutine)."""
    # Arrange - Mock current_price_data to return tuple like real API
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    from datetime import datetime

    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert - should handle tuple return value correctly
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 1
        assert measurements[0].measurement == "electricity_prices_euro"
