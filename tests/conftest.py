"""Test configuration and fixtures."""

from unittest.mock import AsyncMock

import pytest
from home_monitoring.config import Settings
from pytest_mock import MockerFixture


@pytest.fixture
def mock_settings() -> Settings:
    """Mock settings."""
    return Settings(
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




@pytest.fixture
def mock_influxdb_client() -> AsyncMock:
    """Mock InfluxDB client."""
    mock_client = AsyncMock()
    mock_client.write = AsyncMock()
    mock_client.write.return_value = None
    mock_client._session = AsyncMock()
    mock_client._session.post = AsyncMock()
    mock_client._session.__aenter__ = AsyncMock(return_value=mock_client._session)
    mock_client._session.__aexit__ = AsyncMock()
    return mock_client


@pytest.fixture
def mock_influxdb(mocker: MockerFixture, mock_settings: Settings) -> AsyncMock:
    """Mock InfluxDB repository."""
    mock = mocker.MagicMock()
    mock.write_points = mocker.AsyncMock()
    mock.write_measurements = mocker.AsyncMock()
    mock.query = mocker.AsyncMock()
    return mock
