"""Unit tests for Gardena service."""
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from pytest_mock import MockerFixture

from home_monitoring.core.mappers.gardena import GardenaMapper
from home_monitoring.services.gardena import GardenaService


@pytest.mark.asyncio(scope="function")
async def test_start_success(mocker: MockerFixture) -> None:
    """Test successful service start."""
    # Arrange
    mock_smart_system = mocker.patch("gardena.smart_system.SmartSystem")
    mock_location = mocker.Mock()
    mock_smart_system.return_value.locations = {"1": mock_location}
    service = GardenaService()

    # Act
    await service.start()

    # Assert
    mock_smart_system.return_value.authenticate.assert_called_once()
    mock_smart_system.return_value.update_locations.assert_called_once()
    mock_smart_system.return_value.update_devices.assert_called_once_with(mock_location)
    mock_smart_system.return_value.start_ws.assert_called_once_with(mock_location)


@pytest.mark.asyncio(scope="function")
async def test_start_no_locations(mocker: MockerFixture) -> None:
    """Test service start with no locations."""
    # Arrange
    mock_smart_system = mocker.patch("gardena.smart_system.SmartSystem")
    mock_smart_system.return_value.locations = {}
    service = GardenaService()

    # Act & Assert
    with pytest.raises(ValueError, match="Expected exactly one location"):
        await service.start()


@pytest.mark.asyncio(scope="function")
async def test_stop_success(mocker: MockerFixture) -> None:
    """Test successful service stop."""
    # Arrange
    mock_smart_system = mocker.patch("gardena.smart_system.SmartSystem")
    service = GardenaService()

    # Act
    await service.stop()

    # Assert
    mock_smart_system.return_value.quit.assert_called_once()


@pytest.mark.asyncio(scope="function")
async def test_handle_device_update_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
) -> None:
    """Test successful device update handling."""
    # Arrange
    service = GardenaService()
    mock_device = mocker.Mock(type="SENSOR")
    mock_points = [{"measurement": "test"}]
    mocker.patch.object(
        GardenaMapper,
        "sensor_data_to_points",
        return_value=mock_points,
    )

    # Act
    await service._handle_device_update(mock_device)

    # Assert
    mock_influxdb._client.write.assert_called_once_with(mock_points)


@pytest.mark.asyncio(scope="function")
async def test_handle_device_update_unsupported_type(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
) -> None:
    """Test handling of unsupported device type."""
    # Arrange
    service = GardenaService()
    mock_device = mocker.Mock(type="UNSUPPORTED")

    # Act
    await service._handle_device_update(mock_device)

    # Assert
    mock_influxdb._client.write.assert_not_called()


@pytest.mark.asyncio(scope="function")
async def test_handle_device_update_write_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
) -> None:
    """Test handling of database write error."""
    # Arrange
    service = GardenaService()
    mock_device = mocker.Mock(type="SENSOR")
    mock_points = [{"measurement": "test"}]
    mocker.patch.object(
        GardenaMapper,
        "sensor_data_to_points",
        return_value=mock_points,
    )
    mock_influxdb._client.write.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await service._handle_device_update(mock_device)
