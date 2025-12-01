"""Unit tests for Tibber service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

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
    mock_consumption_node_hourly = MagicMock()
    mock_consumption_node_hourly.cost = 0.45
    mock_consumption_node_hourly.consumption = 1.5

    mock_consumption_node_daily = MagicMock()
    mock_consumption_node_daily.cost = 7.65
    mock_consumption_node_daily.consumption = 25.5

    mock_consumption_nodes_24h = []
    for _ in range(24):
        node = MagicMock()
        node.cost = 0.30
        node.consumption = 1.0
        mock_consumption_nodes_24h.append(node)

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(
        side_effect=[
            None,  # Initial call without parameters
            [mock_consumption_node_hourly],  # Last hour
            [mock_consumption_node_daily],  # Yesterday
            mock_consumption_nodes_24h,  # Last 24h
        ]
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        # 1 price + 2 last_hour + 2 yesterday + 2 last_24h
        expected_count = 7
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
    mock_consumption_node = MagicMock()
    mock_consumption_node.cost = 0.45
    mock_consumption_node.consumption = 1.5

    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )
    mock_home.fetch_consumption_data = AsyncMock(
        side_effect=[
            None,  # Initial call without parameters
            [mock_consumption_node],  # Subsequent parametrized calls
            [mock_consumption_node],
            [mock_consumption_node],
        ]
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
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
    # All consumption data calls fail (after initial call)
    mock_home.fetch_consumption_data = AsyncMock(
        side_effect=[
            None,  # Initial call without parameters
            Exception("Hourly data unavailable"),
            Exception("Daily data unavailable"),
            Exception("24h data unavailable"),
        ]
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
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
