"""Unit tests for SolarEdge service."""
from datetime import datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pytest_mock import MockerFixture

from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.solaredge import SolarEdgeService


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection."""
    # Arrange
    service = SolarEdgeService(settings=mock_settings)
    mock_overview = {
        "overview": {
            "lastUpdateTime": "2024-02-16 20:00:00",
            "lifeTimeData": {"energy": 5000000.0},
            "lastYearData": {"energy": 1000000.0},
            "lastMonthData": {"energy": 300000.0},
            "lastDayData": {"energy": 10000.0},
            "currentPower": {"power": 1500.0},
        }
    }
    mock_power_flow = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "connections": [],
            "grid": {"currentPower": 100.0},
            "load": {"currentPower": 1600.0},
            "pv": {"currentPower": 1500.0},
        }
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock(return_value=None)
        mock_response.json = AsyncMock(side_effect=[
            mock_overview,
            mock_power_flow,
        ])
        mock_get.return_value = mock_response

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 2
        assert measurements[0].fields["current_power"] == 1500.0
        assert measurements[1].fields["pv_power"] == 1500.0


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_overview_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of overview API error."""
    # Arrange
    service = SolarEdgeService(settings=mock_settings)

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_get.side_effect = httpx.HTTPError("API Error")

        # Act & Assert
        with pytest.raises(APIError):
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
    service = SolarEdgeService(settings=mock_settings)
    mock_overview = {
        "overview": {
            "lastUpdateTime": "2024-02-16 20:00:00",
            "lifeTimeData": {"energy": 5000000.0},
            "lastYearData": {"energy": 1000000.0},
            "lastMonthData": {"energy": 300000.0},
            "lastDayData": {"energy": 10000.0},
            "currentPower": {"power": 1500.0},
        }
    }
    mock_power_flow = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "connections": [],
            "grid": {"currentPower": 100.0},
            "load": {"currentPower": 1600.0},
            "pv": {"currentPower": 1500.0},
        }
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock(return_value=None)
        mock_response.json = AsyncMock(side_effect=[
            mock_overview,
            mock_power_flow,
        ])
        mock_get.return_value = mock_response

        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store()


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_invalid_response(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of invalid API response."""
    # Arrange
    service = SolarEdgeService(settings=mock_settings)

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.raise_for_status = AsyncMock(return_value=None)
        mock_response.json = AsyncMock(return_value={"invalid": "data"})
        mock_get.return_value = mock_response

        # Act & Assert
        with pytest.raises(APIError):
            await service.collect_and_store()
