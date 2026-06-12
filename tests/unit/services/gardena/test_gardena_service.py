"""Tests for Gardena smart system service."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.gardena.service import GardenaService


@pytest.fixture
def settings() -> Settings:
    """Create test settings."""
    return Settings(
        gardena_application_id="test_id",
        gardena_application_secret="test_secret",
        gardena_email="test@example.com",
        gardena_password="test_password",
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database."""
    db = AsyncMock()
    db.write_measurements = AsyncMock()
    return db


@pytest.fixture
def mock_smart_system() -> MagicMock:
    """Create mock Gardena SmartSystem."""
    system = MagicMock()
    location = MagicMock()
    location.devices = {
        "device1": MagicMock(
            id="device1",
            name="Test Sensor",
            type="SENSOR",
            add_callback=MagicMock(),
        )
    }
    location.find_device_by_type = MagicMock(return_value=[location.devices["device1"]])
    system.locations = {"location1": location}
    system.authenticate = AsyncMock()
    system.update_locations = AsyncMock()
    system.update_devices = AsyncMock()
    system.start_ws = AsyncMock()
    system.quit = AsyncMock()
    return system


@pytest.fixture
def service(
    settings: Settings,
    mock_db: AsyncMock,
    mock_smart_system: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> GardenaService:
    """Create test service."""
    monkeypatch.setattr(
        "home_monitoring.repositories.influxdb.InfluxDBRepository",
        lambda: mock_db,
    )
    monkeypatch.setattr(
        "home_monitoring.services.gardena.service.SmartSystem",
        lambda *args, **kwargs: mock_smart_system,
    )
    return GardenaService(settings=settings)


def test_init_with_valid_credentials(
    settings: Settings,
) -> None:
    """Test service initialization with valid credentials."""
    service = GardenaService(settings=settings)
    assert service._settings == settings


def test_init_with_missing_credentials() -> None:
    """Test service initialization with missing credentials."""
    settings = Settings()

    with pytest.raises(ValueError) as exc_info:
        GardenaService(settings=settings)

    assert "Missing Gardena credentials" in str(exc_info.value)


def test_init_smart_system_parameters(
    monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    """Test SmartSystem initialization parameters."""
    mock_calls: list[tuple[str, dict]] = []

    class MockSmartSystem:
        def __init__(self, **kwargs: str) -> None:
            mock_calls.append(("__init__", kwargs))

    monkeypatch.setattr(
        "home_monitoring.services.gardena.service.SmartSystem", MockSmartSystem
    )
    monkeypatch.setattr(
        "home_monitoring.repositories.influxdb.InfluxDBRepository",
        lambda: AsyncMock(),
    )

    GardenaService(settings=settings)

    assert len(mock_calls) == 1
    assert mock_calls[0][0] == "__init__"
    assert mock_calls[0][1] == {
        "client_id": settings.gardena_application_id,
        "client_secret": settings.gardena_application_secret,
    }


@pytest.mark.asyncio(scope="function")
async def test_start_success(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """Test successful service start."""
    await service.start()

    assert mock_smart_system.authenticate.await_count == 1
    assert mock_smart_system.update_locations.await_count == 1
    assert mock_smart_system.update_devices.await_count == 1
    assert mock_smart_system.start_ws.await_count == 1


@pytest.mark.asyncio(scope="function")
async def test_start_no_locations(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """Test service start with no locations."""
    mock_smart_system.locations = {}

    with pytest.raises(ValueError, match="Expected exactly one location"):
        await service.start()

    assert mock_smart_system.authenticate.await_count == 1
    assert mock_smart_system.update_locations.await_count == 1
    assert not mock_smart_system.start_ws.called


@pytest.mark.asyncio(scope="function")
async def test_start_multiple_locations(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """Test service start with multiple locations."""
    mock_smart_system.locations = {"loc1": MagicMock(), "loc2": MagicMock()}

    with pytest.raises(ValueError, match="Expected exactly one location"):
        await service.start()

    assert mock_smart_system.authenticate.await_count == 1
    assert mock_smart_system.update_locations.await_count == 1
    assert not mock_smart_system.start_ws.called


@pytest.mark.asyncio(scope="function")
async def test_stop_success(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """Test successful service stop."""
    await service.stop()

    assert mock_smart_system.quit.await_count == 1


def _real_sensor() -> MagicMock:
    """A SENSOR device with real numeric attributes (not MagicMock auto-attrs)."""
    d = MagicMock(
        spec=[
            "id",
            "name",
            "type",
            "ambient_temperature",
            "soil_humidity",
            "light_intensity",
            "rf_link_level",
            "battery_level",
            "add_callback",
        ]
    )
    d.id = "s1"
    d.name = "Garten"
    d.type = "SENSOR"
    d.ambient_temperature = 20.5
    d.soil_humidity = 42.0
    d.light_intensity = 1200.0
    d.rf_link_level = 80.0
    d.battery_level = 95.0
    return d


@pytest.mark.asyncio
async def test_start_writes_initial_state(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """start() persists the initial device state, not just on later changes."""
    sensor = _real_sensor()
    loc = next(iter(mock_smart_system.locations.values()))
    loc.find_device_by_type = MagicMock(
        side_effect=lambda t: [sensor] if t == "SENSOR" else []
    )
    mock_smart_system.location = loc
    service._db = AsyncMock()

    await service.start()

    # registered for future change events AND wrote the baseline now
    sensor.add_callback.assert_called_once()
    assert service._db.write_measurements.await_count >= 1


@pytest.mark.asyncio
async def test_refresh_all_rewrites_current_state(
    service: GardenaService, mock_smart_system: MagicMock
) -> None:
    """refresh_all() re-persists current device state (the cadence heartbeat)."""
    sensor = _real_sensor()
    loc = next(iter(mock_smart_system.locations.values()))
    loc.find_device_by_type = MagicMock(
        side_effect=lambda t: [sensor] if t == "SENSOR" else []
    )
    mock_smart_system.location = loc
    service._db = AsyncMock()

    await service.refresh_all()

    assert service._db.write_measurements.await_count >= 1
