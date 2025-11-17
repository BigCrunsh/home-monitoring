"""Common test fixtures for InfluxDB."""
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from home_monitoring.repositories.influxdb import InfluxDBRepository


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
def mock_influxdb(mocker: MockerFixture, mock_influxdb_client: AsyncMock) -> AsyncMock:
    """Mock InfluxDB repository."""
    mock = AsyncMock()
    mock._client = mock_influxdb_client
    mocker.patch(
        "home_monitoring.repositories.influxdb.InfluxDBRepository",
        return_value=mock,
    )
    return mock
