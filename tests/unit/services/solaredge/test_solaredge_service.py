"""Tests for SolarEdge service."""

from datetime import UTC, datetime
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




def test_init_with_missing_credentials() -> None:
    """Test service initialization with missing credentials."""
    settings = Settings()

    with pytest.raises(ValueError, match="Missing SolarEdge credentials"):
        SolarEdgeService(settings=settings)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_power_details_success(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test successful collection and storage of power details data."""
    start_time = datetime(2015, 11, 21, 11, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 21, 11, 30, 0, tzinfo=UTC)

    power_details_response = {
        "powerDetails": {
            "timeUnit": "QUARTER_OF_AN_HOUR",
            "unit": "W",
            "meters": [
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
                {
                    "type": "Purchased",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
            ],
        }
    }

    mock_client.get.return_value.json.return_value = power_details_response

    await service.collect_and_store_power_details(
        start_time,
        end_time,
        meters=["PRODUCTION", "CONSUMPTION"],
    )

    assert mock_client.get.call_count == 1
    assert mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_energy_details_success(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test successful collection and storage of energy details data."""
    start_time = datetime(2015, 11, 16, 0, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 23, 0, 0, 0, tzinfo=UTC)

    energy_details_response = {
        "energyDetails": {
            "timeUnit": "WEEK",
            "unit": "Wh",
            "meters": [
                {
                    "type": "Production",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 2953},
                    ],
                },
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 29885},
                    ],
                },
            ],
        }
    }

    mock_client.get.return_value.json.return_value = energy_details_response

    await service.collect_and_store_energy_details(
        start_time,
        end_time,
        time_unit="WEEK",
        meters=["PRODUCTION", "CONSUMPTION"],
    )

    assert mock_client.get.call_count == 1
    assert mock_db.write_measurements.called
    measurements = mock_db.write_measurements.call_args.args[0]
    assert len(measurements) == 1


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_energy_details_api_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of API errors when fetching energy details."""
    start_time = datetime(2015, 11, 16, 0, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 23, 0, 0, 0, tzinfo=UTC)

    mock_client.get.return_value.raise_for_status.side_effect = APIError("API error")

    with pytest.raises(APIError, match="SolarEdge API request failed"):
        await service.collect_and_store_energy_details(
            start_time,
            end_time,
            time_unit="WEEK",
        )

    assert mock_client.get.called
    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_energy_details_database_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of database errors when storing energy details."""
    start_time = datetime(2015, 11, 16, 0, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 23, 0, 0, 0, tzinfo=UTC)

    energy_details_response = {
        "energyDetails": {
            "timeUnit": "WEEK",
            "unit": "Wh",
            "meters": [
                {
                    "type": "Production",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 2953},
                    ],
                },
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 29885},
                    ],
                },
            ],
        }
    }

    mock_client.get.return_value.json.return_value = energy_details_response
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store_energy_details(
            start_time,
            end_time,
            time_unit="WEEK",
        )

    assert mock_client.get.call_count == 1
    assert mock_db.write_measurements.called
    measurements = mock_db.write_measurements.call_args.args[0]
    assert len(measurements) == 1


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_power_details_api_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of API errors when fetching power details."""
    start_time = datetime(2015, 11, 21, 11, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 21, 11, 30, 0, tzinfo=UTC)

    mock_client.get.return_value.raise_for_status.side_effect = APIError("API error")

    with pytest.raises(APIError, match="SolarEdge API request failed"):
        await service.collect_and_store_power_details(start_time, end_time)

    assert mock_client.get.called
    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_power_details_database_error(
    service: SolarEdgeService, mock_client: MagicMock, mock_db: AsyncMock
) -> None:
    """Test handling of database errors when storing power details."""
    start_time = datetime(2015, 11, 21, 11, 0, 0, tzinfo=UTC)
    end_time = datetime(2015, 11, 21, 11, 30, 0, tzinfo=UTC)

    power_details_response = {
        "powerDetails": {
            "timeUnit": "QUARTER_OF_AN_HOUR",
            "unit": "W",
            "meters": [
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
                {
                    "type": "Purchased",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
            ],
        }
    }

    mock_client.get.return_value.json.return_value = power_details_response
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store_power_details(start_time, end_time)

    assert mock_client.get.call_count == 1
    assert mock_db.write_measurements.called
