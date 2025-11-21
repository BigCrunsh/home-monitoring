"""Tests for SolarEdge service."""
from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.solaredge.service import SolarEdgeService


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(
        solaredge_api_key="test_key",
        solaredge_site_id="test_site",
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database."""
    db = AsyncMock()
    db.write_measurements = AsyncMock()
    return db


@pytest.fixture
def mock_client() -> MagicMock:
    """Create mock HTTP client."""
    client = MagicMock()
    
    # Create mock response
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = MagicMock()
    
    # Set up the client methods
    client.get = AsyncMock(return_value=mock_response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    
    return client


@pytest.fixture
def service(
    settings: Settings,
    mock_db: AsyncMock,
    mock_client: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> SolarEdgeService:
    """Create test service."""
    monkeypatch.setattr(
        "home_monitoring.services.solaredge.service.InfluxDBRepository",
        lambda *args, **kwargs: mock_db,
    )
    monkeypatch.setattr(
        "home_monitoring.services.solaredge.service.httpx.AsyncClient",
        lambda *args, **kwargs: mock_client,
    )
    return SolarEdgeService(settings=settings)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test successful data collection and storage."""
    overview_data = {
        "overview": {
            "lastUpdateTime": "2023-11-19 12:00:00",
            "lifeTimeData": {"energy": 1000.0},
            "lastYearData": {"energy": 500.0},
            "lastMonthData": {"energy": 100.0},
            "lastDayData": {"energy": 10.0},
            "currentPower": {"power": 2.5},
        }
    }
    power_flow_data = {
        "siteCurrentPowerFlow": {
            "unit": "kW",
            "connections": [],
            "GRID": {"status": "Active", "currentPower": 1.0},
            "LOAD": {"status": "Active", "currentPower": 0.5},
            "PV": {"status": "Active", "currentPower": 1.5},
        }
    }

    mock_client.get.return_value.json.side_effect = [
        overview_data,
        power_flow_data,
    ]

    await service.collect_and_store()

    assert mock_client.get.call_count == 2
    assert mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of API errors."""
    mock_client.get.return_value.raise_for_status.side_effect = APIError("API error")

    with pytest.raises(APIError, match="SolarEdge API request failed"):
        await service.collect_and_store()

    assert mock_client.get.called
    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of database errors."""
    overview_data = {
        "overview": {
            "lastUpdateTime": "2023-11-19 12:00:00",
            "lifeTimeData": {"energy": 1000.0},
            "lastYearData": {"energy": 500.0},
            "lastMonthData": {"energy": 100.0},
            "lastDayData": {"energy": 10.0},
            "currentPower": {"power": 2.5},
        }
    }
    power_flow_data = {
        "siteCurrentPowerFlow": {
            "unit": "kW",
            "connections": [],
            "GRID": {"status": "Active", "currentPower": 1.0},
            "LOAD": {"status": "Active", "currentPower": 0.5},
            "PV": {"status": "Active", "currentPower": 1.5},
        }
    }

    mock_client.get.return_value.json.side_effect = [
        overview_data,
        power_flow_data,
    ]
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store()

    assert mock_client.get.call_count == 2
    assert mock_db.write_measurements.called


def test_init_with_missing_credentials() -> None:
    """Test service initialization with missing credentials."""
    settings = Settings()

    with pytest.raises(ValueError, match="Missing SolarEdge credentials"):
        SolarEdgeService(settings=settings)
