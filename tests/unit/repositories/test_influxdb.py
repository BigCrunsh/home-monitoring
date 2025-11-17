"""Unit tests for InfluxDB repository."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from home_monitoring.config import Settings
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository
from tests.unit.repositories.constants import (
    EXPECTED_MEASUREMENTS,
    FIELD_VALUE_1,
    FIELD_VALUE_2,
)


@pytest.mark.asyncio(scope="function")
async def test_write_measurement_success(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful write of single measurement."""
    # Arrange
    repository = InfluxDBRepository(
        settings=mock_settings,
        client=mock_influxdb_client,
    )
    measurement = Measurement(
        measurement="test",
        tags={"tag1": "value1"},
        timestamp=datetime.now(UTC),
        fields={"field1": FIELD_VALUE_1},
    )

    # Act
    await repository.write_measurement(measurement)

    # Assert
    mock_influxdb_client.write.assert_called_once()
    points = mock_influxdb_client.write.call_args[0][0]
    assert len(points) == 1
    assert points[0]["measurement"] == "test"
    assert points[0]["tags"] == {"tag1": "value1"}
    assert points[0]["fields"] == {"field1": FIELD_VALUE_1}


@pytest.mark.asyncio(scope="function")
async def test_write_measurement_error(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test error handling in write_measurement."""
    # Arrange
    repository = InfluxDBRepository(
        settings=mock_settings,
        client=mock_influxdb_client,
    )
    measurement = Measurement(
        measurement="test",
        tags={"tag1": "value1"},
        timestamp=datetime.now(UTC),
        fields={"field1": FIELD_VALUE_1},
    )
    mock_influxdb_client.write.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await repository.write_measurement(measurement)


@pytest.mark.asyncio(scope="function")
async def test_write_measurements_success(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful write of multiple measurements."""
    # Arrange
    repository = InfluxDBRepository(
        settings=mock_settings,
        client=mock_influxdb_client,
    )
    measurements = [
        Measurement(
            measurement="test1",
            tags={"tag1": "value1"},
            timestamp=datetime.now(UTC),
            fields={"field1": FIELD_VALUE_1},
        ),
        Measurement(
            measurement="test2",
            tags={"tag2": "value2"},
            timestamp=datetime.now(UTC),
            fields={"field2": FIELD_VALUE_2},
        ),
    ]

    # Act
    await repository.write_measurements(measurements)

    # Assert
    mock_influxdb_client.write.assert_called_once()
    points = mock_influxdb_client.write.call_args[0][0]
    assert len(points) == EXPECTED_MEASUREMENTS
    assert points[0]["measurement"] == "test1"
    assert points[0]["tags"] == {"tag1": "value1"}
    assert points[0]["fields"] == {"field1": FIELD_VALUE_1}
    assert points[1]["measurement"] == "test2"
    assert points[1]["tags"] == {"tag2": "value2"}
    assert points[1]["fields"] == {"field2": FIELD_VALUE_2}


@pytest.mark.asyncio(scope="function")
async def test_write_measurements_error(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test error handling in write_measurements."""
    # Arrange
    repository = InfluxDBRepository(
        settings=mock_settings,
        client=mock_influxdb_client,
    )
    measurements = [
        Measurement(
            measurement="test1",
            tags={"tag1": "value1"},
            timestamp=datetime.now(UTC),
            fields={"field1": FIELD_VALUE_1},
        ),
        Measurement(
            measurement="test2",
            tags={"tag2": "value2"},
            timestamp=datetime.now(UTC),
            fields={"field2": FIELD_VALUE_2},
        ),
    ]
    mock_influxdb_client.write.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await repository.write_measurements(measurements)
