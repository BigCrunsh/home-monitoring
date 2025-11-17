"""Unit tests for Tankerkoenig service."""

from unittest.mock import AsyncMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.tankerkoenig.client import TankerkoenigClient
from home_monitoring.services.tankerkoenig.service import TankerkoenigService
from pytest_mock import MockerFixture


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection and storage."""
    # Arrange
    mock_client = AsyncMock()
    mock_client.get_prices = AsyncMock(
        return_value={
            "ok": True,
            "prices": {
                "123": {
                    "diesel": 1.599,
                    "e5": 1.799,
                    "e10": 1.749,
                    "status": "open",
                },
            },
        }
    )
    mock_client.get_stations_details = AsyncMock(
        return_value={
            "ok": True,
            "123": {
                "name": "Test Station",
                "brand": "Test Brand",
                "street": "Test Street",
                "place": "Test Place",
                "postCode": "12345",
            },
        }
    )
    mocker.patch.object(
        TankerkoenigClient,
        "__init__",
        return_value=None,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_prices",
        side_effect=mock_client.get_prices,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_stations_details",
        side_effect=mock_client.get_stations_details,
    )

    # Create service
    service = TankerkoenigService(settings=mock_settings, repository=mock_influxdb)

    # Act
    await service.collect_and_store(station_ids=["123"])

    # Assert
    mock_influxdb.write_measurements.assert_called_once()
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == 1
    assert measurements[0].measurement == "gas_prices"
    assert measurements[0].tags["station_id"] == "123"
    assert measurements[0].fields["diesel"] == 1.599


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of API error."""
    # Arrange
    mock_client = AsyncMock()
    mock_client.get_prices = AsyncMock(side_effect=APIError("API Error"))
    mocker.patch.object(
        TankerkoenigClient,
        "__init__",
        return_value=None,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_prices",
        side_effect=mock_client.get_prices,
    )

    # Create service
    service = TankerkoenigService(settings=mock_settings, repository=mock_influxdb)

    # Act & Assert
    with pytest.raises(APIError, match="API Error"):
        await service.collect_and_store(station_ids=["123"])

    assert not mock_influxdb.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of database error."""
    # Arrange
    mock_client = AsyncMock()
    mock_client.get_prices = AsyncMock(
        return_value={
            "ok": True,
            "prices": {
                "123": {
                    "diesel": 1.599,
                    "e5": 1.799,
                    "e10": 1.749,
                    "status": "open",
                },
            },
        }
    )
    mock_client.get_stations_details = AsyncMock(
        return_value={
            "ok": True,
            "123": {
                "name": "Test Station",
                "brand": "Test Brand",
                "street": "Test Street",
                "place": "Test Place",
                "postCode": "12345",
            },
        }
    )
    mocker.patch.object(
        TankerkoenigClient,
        "__init__",
        return_value=None,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_prices",
        side_effect=mock_client.get_prices,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_stations_details",
        side_effect=mock_client.get_stations_details,
    )

    # Create service
    service = TankerkoenigService(settings=mock_settings, repository=mock_influxdb)

    # Set up database error
    mock_influxdb.write_measurements.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await service.collect_and_store(station_ids=["123"])


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_invalid_response(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of invalid API response."""
    # Arrange
    mock_client = AsyncMock()
    mock_client.get_prices = AsyncMock(
        return_value={
            "ok": False,
            "message": "eine oder mehrere Tankstellen-IDs nicht im korrekten Format",
        }
    )
    mocker.patch.object(
        TankerkoenigClient,
        "__init__",
        return_value=None,
    )
    mocker.patch.object(
        TankerkoenigClient,
        "get_prices",
        side_effect=mock_client.get_prices,
    )

    # Create service
    service = TankerkoenigService(settings=mock_settings, repository=mock_influxdb)

    # Act & Assert
    with pytest.raises(
        APIError, match="eine oder mehrere Tankstellen-IDs nicht im korrekten Format"
    ):
        await service.collect_and_store(station_ids=["123"])

    assert not mock_influxdb.write_measurements.called
