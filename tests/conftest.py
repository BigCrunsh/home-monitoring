"""Test configuration and fixtures."""
import asyncio
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from home_monitoring.config import Settings
from home_monitoring.repositories.influxdb import InfluxDBRepository


@pytest.fixture
def mock_settings(mocker: MockerFixture) -> Settings:
    """Mock settings."""
    settings = Settings(
        # InfluxDB settings
        influxdb_host="localhost",
        influxdb_port=8086,
        influxdb_database="test",
        influxdb_username="test",
        influxdb_password="test",
        # Netatmo settings
        netatmo_client_id="test",
        netatmo_client_secret="test",
        netatmo_username="test",
        netatmo_password="test",
        # SolarEdge settings
        solaredge_api_key="test",
        solaredge_site_id="test",
        # Gardena settings
        gardena_client_id="test",
        gardena_client_secret="test",
        gardena_username="test",
        gardena_password="test",
        # Tibber settings
        tibber_access_token="test",
        # Tankerkoenig settings
        tankerkoenig_api_key="test",
        # Logging settings
        log_level="INFO",
        json_logs=False,
    )
    # Patch config module
    mocker.patch("home_monitoring.config._settings", settings)
    mocker.patch("home_monitoring.config.Settings", return_value=settings)
    return settings


@pytest.fixture(scope="session")
def event_loop_policy():
    """Event loop policy fixture."""
    policy = asyncio.get_event_loop_policy()
    return policy


@pytest.fixture
def mock_influxdb_client() -> AsyncMock:
    """Mock InfluxDB client."""
    mock_client = AsyncMock()
    mock_client.write = AsyncMock()
    mock_client.write.return_value = None
    mock_client._session = AsyncMock()
    mock_client._session.post = AsyncMock()
    return mock_client


@pytest.fixture
def mock_influxdb(mocker: MockerFixture) -> AsyncMock:
    """Mock InfluxDB repository."""
    mock = AsyncMock()
    mock.write_measurements = AsyncMock()
    mocker.patch.object(
        InfluxDBRepository,
        "write_measurements",
        side_effect=mock.write_measurements,
    )
    return mock
