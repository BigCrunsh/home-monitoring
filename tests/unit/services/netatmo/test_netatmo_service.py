"""Tests for Netatmo service."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.netatmo.service import NetatmoService


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(
        netatmo_client_id="test_id",
        netatmo_client_secret="test_secret",
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database."""
    db = AsyncMock()
    db.write_measurements = AsyncMock()
    return db


@pytest.fixture
def mock_auth() -> MagicMock:
    """Create mock lnetatmo ClientAuth."""
    auth = MagicMock()
    auth.clientId = "test_id"
    auth.clientSecret = "test_secret"
    auth.accessToken = "test_access_token"
    return auth


@pytest.fixture
def mock_api() -> MagicMock:
    """Create mock lnetatmo WeatherStationData."""
    api = MagicMock()
    api.stations = ["test_station"]
    # Mock station data
    station_data = {
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

    api.stationById = MagicMock(return_value=station_data)
    return api


@pytest.fixture
def service(
    settings: Settings,
    mock_db: AsyncMock,
    mock_auth: MagicMock,
    mock_api: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> NetatmoService:
    """Create test service."""
    monkeypatch.setattr(
        "home_monitoring.services.netatmo.service.InfluxDBRepository",
        lambda *args, **kwargs: mock_db,
    )
    monkeypatch.setattr(
        "home_monitoring.services.netatmo.service.lnetatmo.ClientAuth",
        lambda *args, **kwargs: mock_auth,
    )
    monkeypatch.setattr(
        "home_monitoring.services.netatmo.service.lnetatmo.WeatherStationData",
        lambda *args, **kwargs: mock_api,
    )
    return NetatmoService(settings=settings)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test successful data collection and storage."""
    # Mock successful station access
    mock_api.stations = ["test_station"]

    await service.collect_and_store()

    assert mock_api.stationById.called
    assert mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of API errors."""
    # Mock no stations available
    mock_api.stations = []

    with pytest.raises(APIError, match="Netatmo API request failed"):
        await service.collect_and_store()

    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    service: NetatmoService, mock_api: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of database errors."""
    # Mock successful station access
    mock_api.stations = ["test_station"]
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store()

    assert mock_api.stationById.called
    assert mock_db.write_measurements.called


def test_init_with_missing_credentials() -> None:
    """Test service initialization with missing credentials."""
    settings = Settings()

    with pytest.raises(ValueError, match="Missing Netatmo credentials"):
        NetatmoService(settings=settings)
