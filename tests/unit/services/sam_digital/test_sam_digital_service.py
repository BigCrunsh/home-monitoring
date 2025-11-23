"""Tests for Sam Digital service."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.sam_digital.service import SamDigitalService

EXPECTED_SAM_SERVICE_MEASUREMENT_COUNT = 1


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(sam_digital_api_key="test_key")


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database repository."""
    db = AsyncMock()
    db.write_measurements = AsyncMock()
    return db


@pytest.fixture
def mock_client() -> MagicMock:
    """Create mock HTTP client for Sam Digital API."""
    client = MagicMock()

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = MagicMock()

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
) -> SamDigitalService:
    """Create test Sam Digital service."""
    monkeypatch.setattr(
        "home_monitoring.services.sam_digital.service.InfluxDBRepository",
        lambda *args, **kwargs: mock_db,
    )
    monkeypatch.setattr(
        "home_monitoring.services.sam_digital.service.httpx.AsyncClient",
        lambda *args, **kwargs: mock_client,
    )
    return SamDigitalService(settings=settings)


def test_init_with_missing_credentials() -> None:
    """Service should fail fast when API key is missing."""
    settings = Settings()

    with pytest.raises(ValueError, match="Missing Sam Digital API key"):
        SamDigitalService(settings=settings)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    service: SamDigitalService,
    mock_client: MagicMock,
    mock_db: AsyncMock,
) -> None:
    """Test successful data collection and storage."""
    devices = [
        {
            "id": "device1",
            "name": "Test Device",
            "data": [
                {"id": "MBR_10", "value": 5.0},
                {"id": "MBR_18", "value": 35.5},
            ],
        }
    ]

    mock_client.get.return_value.json.return_value = {"items": devices}

    await service.collect_and_store()

    assert mock_client.get.call_count == 1
    mock_db.write_measurements.assert_called_once()
    measurements = mock_db.write_measurements.call_args.args[0]
    assert len(measurements) == EXPECTED_SAM_SERVICE_MEASUREMENT_COUNT
    names = {m.measurement for m in measurements}
    assert names == {"heat_temperature_celsius"}


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_no_measurements(
    service: SamDigitalService,
    mock_client: MagicMock,
    mock_db: AsyncMock,
) -> None:
    """No measurements should be written when mapper yields none."""
    devices = [
        {
            "id": "device1",
            "name": "Test Device",
            "data": [
                {"id": "UNKNOWN", "value": 1.0},
            ],
        }
    ]

    mock_client.get.return_value.json.return_value = {"items": devices}

    with pytest.raises(APIError, match="No Sam Digital measurements created"):
        await service.collect_and_store()

    mock_db.write_measurements.assert_not_called()


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    service: SamDigitalService,
    mock_client: MagicMock,
    mock_db: AsyncMock,
) -> None:
    """Test handling of API errors."""
    mock_client.get.return_value.raise_for_status.side_effect = Exception(
        "API error",
    )

    with pytest.raises(APIError, match="Sam Digital API request failed"):
        await service.collect_and_store()

    assert mock_client.get.called
    assert not mock_db.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    service: SamDigitalService,
    mock_client: MagicMock,
    mock_db: AsyncMock,
) -> None:
    """Test handling of database errors."""
    devices = [
        {
            "id": "device1",
            "name": "Test Device",
            "data": [
                {"id": "MBR_10", "value": 5.0},
            ],
        }
    ]

    mock_client.get.return_value.json.return_value = {"items": devices}
    mock_db.write_measurements.side_effect = Exception("Database error")

    with pytest.raises(Exception, match="Database error"):
        await service.collect_and_store()

    assert mock_client.get.called
    assert mock_db.write_measurements.called
