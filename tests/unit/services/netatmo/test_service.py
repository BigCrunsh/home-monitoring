"""Unit tests for Netatmo service."""
from unittest.mock import AsyncMock, patch, PropertyMock

import pytest
from pytest_mock import MockerFixture

from home_monitoring.config import Settings
from home_monitoring.services.netatmo import NetatmoService


@pytest.fixture
def mock_netatmo(mocker: MockerFixture) -> AsyncMock:
    """Mock Netatmo API."""
    mock_api = AsyncMock()
    mock_api.access_token = PropertyMock(return_value="test-token")
    mocker.patch("netatmo.WeatherStation", return_value=mock_api)
    return mock_api


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
    mock_netatmo: AsyncMock,
) -> None:
    """Test successful data collection."""
    # Arrange
    service = NetatmoService(settings=mock_settings)
    mock_data = {
        "devices": [
            {
                "_id": "test-device",
                "module_name": "Test Device",
                "type": "NAMain",
                "dashboard_data": {
                    "Temperature": 20.5,
                    "Humidity": 50,
                    "CO2": 800,
                    "Pressure": 1015.2,
                    "Noise": 45,
                },
                "modules": [
                    {
                        "_id": "test-module",
                        "module_name": "Test Module",
                        "type": "NAModule1",
                        "dashboard_data": {
                            "Temperature": 18.5,
                            "Humidity": 55,
                        },
                    }
                ],
            }
        ]
    }

    mock_netatmo.get_data = AsyncMock(return_value=True)
    mock_netatmo.devices = mock_data["devices"]

    # Act
    await service.collect_and_store()

    # Assert
    mock_influxdb.write_measurements.assert_called_once()
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == 2
    assert measurements[0].fields["Temperature"] == 20.5
    assert measurements[1].fields["Temperature"] == 18.5


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
    mock_netatmo: AsyncMock,
) -> None:
    """Test handling of API error."""
    # Arrange
    service = NetatmoService(settings=mock_settings)
    mock_netatmo.get_data = AsyncMock(return_value=False)

    # Act & Assert
    with pytest.raises(RuntimeError, match="Failed to get weather station data"):
        await service.collect_and_store()

    assert not mock_influxdb.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_invalid_response(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
    mock_netatmo: AsyncMock,
) -> None:
    """Test handling of invalid API response."""
    # Arrange
    service = NetatmoService(settings=mock_settings)
    mock_netatmo.get_data = AsyncMock(return_value=True)
    mock_netatmo.devices = [{"invalid": "data"}]

    # Act & Assert
    await service.collect_and_store()

    # Should write no points but not fail
    assert mock_influxdb.write_measurements.called
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == 0


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
    mock_netatmo: AsyncMock,
) -> None:
    """Test handling of database error."""
    # Arrange
    service = NetatmoService(settings=mock_settings)
    mock_data = {
        "devices": [
            {
                "_id": "test-device",
                "module_name": "Test Device",
                "type": "NAMain",
                "dashboard_data": {
                    "Temperature": 20.5,
                },
            }
        ]
    }

    mock_netatmo.get_data = AsyncMock(return_value=True)
    mock_netatmo.devices = mock_data["devices"]
    mock_influxdb.write_measurements.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await service.collect_and_store()
