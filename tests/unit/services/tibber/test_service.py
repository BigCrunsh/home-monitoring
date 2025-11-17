"""Unit tests for Tibber service."""
import pytest
from pytest_mock import MockerFixture
from unittest.mock import AsyncMock, MagicMock, patch

from home_monitoring.config import Settings
from home_monitoring.services.tibber.service import TibberService


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection and storage."""
    # Arrange
    mock_home = MagicMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data.return_value = {
        "total": 1.234,
        "energy": 0.567,
        "tax": 0.123,
        "startsAt": "2024-02-16T20:00:00",
        "currency": "NOK",
        "level": "NORMAL",
    }

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes.return_value = [mock_home]

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings)

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_points.assert_called_once()
        points = mock_influxdb.write_points.call_args[0][0]
        assert len(points) > 0
        assert points[0].measurement == "electricity_prices"


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
        service = TibberService(settings=mock_settings)

        # Act & Assert
        with pytest.raises(Exception, match="API Error"):
            await service.collect_and_store()

        assert not mock_influxdb.write_points.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of database error."""
    # Arrange
    mock_home = MagicMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data.return_value = {
        "total": 1.234,
        "energy": 0.567,
        "tax": 0.123,
        "startsAt": "2024-02-16T20:00:00",
        "currency": "NOK",
        "level": "NORMAL",
    }

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes.return_value = [mock_home]

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service and set up database error
        service = TibberService(settings=mock_settings)
        mock_influxdb.write_points.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store()
