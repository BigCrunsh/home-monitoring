"""Tests for Netatmo service."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.netatmo.service import NetatmoService


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(
        netatmo_client_id="test_id",
        netatmo_client_secret="test_secret",
        netatmo_username="test@example.com",
        netatmo_password="test_password",
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database."""
    db = AsyncMock()
    db.write_measurements = AsyncMock()
    return db


@pytest.fixture
def mock_api() -> MagicMock:
    """Create mock Netatmo API."""
    api = MagicMock()
    api.get_data = AsyncMock()
    api.devices = {
        "test_station": {
            "_id": "test_station",
            "type": "NAMain",
            "module_name": "Test Station",
            "dashboard_data": {
                "Temperature": 20.5,
                "Humidity": 50,
                "CO2": 400,
                "Noise": 40,
                "Pressure": 1013.2,
                "time_utc": 1637500000,
            },
            "modules": [
                {
                    "_id": "test_module",
                    "type": "NAModule1",
                    "module_name": "Test Module",
                    "dashboard_data": {
                        "Temperature": 18.5,
                        "Humidity": 55,
                        "time_utc": 1637500000,
                    },
                }
            ],
        }
    }
    api._session = AsyncMock()
    api._session.close = AsyncMock()
    return api


@pytest.fixture
def service(
    settings: Settings,
    mock_db: AsyncMock,
    mock_api: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> NetatmoService:
    """Create test service."""
    monkeypatch.setattr(
        "home_monitoring.services.netatmo.service.InfluxDBRepository",
        lambda *args, **kwargs: mock_db
    )
    monkeypatch.setattr(
        "home_monitoring.services.netatmo.service.netatmo.WeatherStation",
        lambda *args, **kwargs: mock_api
    )
    return NetatmoService(settings=settings)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test successful data collection and storage."""
    mock_api.get_data.return_value = True
    mock_api.devices = {
        "test_station": {
            "_id": "test_station",
            "type": "NAMain",
            "module_name": "Test Station",
            "dashboard_data": {
                "Temperature": 20.5,
                "Humidity": 50,
                "CO2": 400,
                "Noise": 40,
                "Pressure": 1013.2,
                "time_utc": 1637500000,
            },
            "modules": [
                {
                    "_id": "test_module",
                    "type": "NAModule1",
                    "module_name": "Test Module",
                    "dashboard_data": {
                        "Temperature": 18.5,
                        "Humidity": 55,
                        "time_utc": 1637500000,
                    },
                }
            ],
        }
    }

    await service.collect_and_store()

    assert mock_api.get_data.called
    assert mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of API errors."""
    mock_api.get_data.return_value = False

    with pytest.raises(RuntimeError, match="Failed to get weather station data"):
        await service.collect_and_store()

    assert mock_api.get_data.called
    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of database errors."""
    mock_api.get_data = AsyncMock(return_value=True)
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store()

    assert mock_api.get_data.called
    assert mock_db.write_measurements.called


def test_init_with_missing_credentials() -> None:
    """Test service initialization with missing credentials."""
    settings = Settings()

    with pytest.raises(ValueError, match="Missing Netatmo credentials"):
        NetatmoService(settings=settings)
