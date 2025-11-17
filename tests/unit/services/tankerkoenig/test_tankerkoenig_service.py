"""Unit tests for Tankerkoenig service."""

from unittest.mock import AsyncMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.tankerkoenig.client import TankerkoenigClient
from home_monitoring.services.tankerkoenig.service import TankerkoenigService
from pytest_mock import MockerFixture

from tests.unit.services.tankerkoenig.constants import (
    TEST_DIESEL_PRICE,
    TEST_E5_PRICE,
    TEST_E10_PRICE,
    TEST_STATION_ID,
    TEST_STATION_NAME,
    TEST_STATION_BRAND,
    TEST_STATION_STREET,
    TEST_STATION_PLACE,
    TEST_STATION_POSTCODE,
)


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
                TEST_STATION_ID: {
                    "diesel": TEST_DIESEL_PRICE,
                    "e5": TEST_E5_PRICE,
                    "e10": TEST_E10_PRICE,
                    "status": "open",
                },
            },
        }
    )
    mock_client.get_stations_details = AsyncMock(
        return_value={
            "ok": True,
            TEST_STATION_ID: {
                "name": TEST_STATION_NAME,
                "brand": TEST_STATION_BRAND,
                "street": TEST_STATION_STREET,
                "place": TEST_STATION_PLACE,
                "postCode": TEST_STATION_POSTCODE,
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
    service = TankerkoenigService(
        settings=mock_settings,
        repository=mock_influxdb,
    )

    # Act
    await service.collect_and_store(station_ids=[TEST_STATION_ID])

    # Assert
    mock_influxdb.write_measurements.assert_called_once()
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == 1
    assert measurements[0].measurement == "gas_prices"
    assert measurements[0].tags["station_id"] == TEST_STATION_ID
    assert measurements[0].fields["diesel"] == TEST_DIESEL_PRICE


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
    service = TankerkoenigService(
        settings=mock_settings,
        repository=mock_influxdb,
    )

    # Act & Assert
    with pytest.raises(APIError, match="API Error"):
        await service.collect_and_store(station_ids=[TEST_STATION_ID])

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
                TEST_STATION_ID: {
                    "diesel": TEST_DIESEL_PRICE,
                    "e5": TEST_E5_PRICE,
                    "e10": TEST_E10_PRICE,
                    "status": "open",
                },
            },
        }
    )
    mock_client.get_stations_details = AsyncMock(
        return_value={
            "ok": True,
            TEST_STATION_ID: {
                "name": TEST_STATION_NAME,
                "brand": TEST_STATION_BRAND,
                "street": TEST_STATION_STREET,
                "place": TEST_STATION_PLACE,
                "postCode": TEST_STATION_POSTCODE,
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
    service = TankerkoenigService(
        settings=mock_settings,
        repository=mock_influxdb,
    )

    # Set up database error
    mock_influxdb.write_measurements.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await service.collect_and_store(station_ids=[TEST_STATION_ID])


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
    service = TankerkoenigService(
        settings=mock_settings,
        repository=mock_influxdb,
    )

    # Act & Assert
    error_message = "eine oder mehrere Tankstellen-IDs nicht im korrekten Format"
    with pytest.raises(APIError, match=error_message):
        await service.collect_and_store(station_ids=[TEST_STATION_ID])

    assert not mock_influxdb.write_measurements.called
