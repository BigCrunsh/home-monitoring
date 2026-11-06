"""Unit tests for InfluxDB repository."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from home_monitoring.config import Settings
from home_monitoring.models.base import Measurement
from home_monitoring.repositories.influxdb import InfluxDBRepository, parse_influx_time
from pytest_mock import MockerFixture

from tests.unit.constants import EXPECTED_ITEM_COUNT


@pytest.mark.asyncio(scope="function")
async def test_write_measurement_success(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful write of single measurement."""
    # Arrange
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)
    measurement = Measurement(
        measurement="test",
        tags={"tag1": "value1"},
        timestamp=datetime.now(UTC),
        fields={"field1": 1.0},
    )

    # Act
    await repository.write_measurement(measurement)

    # Assert
    mock_influxdb_client.write.assert_called_once()
    points = mock_influxdb_client.write.call_args[0][0]
    assert len(points) == 1
    assert points[0]["measurement"] == "test"
    assert points[0]["tags"] == {"tag1": "value1"}
    assert points[0]["fields"] == {"field1": 1.0}


@pytest.mark.asyncio(scope="function")
async def test_write_measurement_error(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test error handling in write_measurement."""
    # Arrange
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)
    measurement = Measurement(
        measurement="test",
        tags={"tag1": "value1"},
        timestamp=datetime.now(UTC),
        fields={"field1": 1.0},
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
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)
    measurements = [
        Measurement(
            measurement="test1",
            tags={"tag1": "value1"},
            timestamp=datetime.now(UTC),
            fields={"field1": 1.0},
        ),
        Measurement(
            measurement="test2",
            tags={"tag2": "value2"},
            timestamp=datetime.now(UTC),
            fields={"field2": 2.0},
        ),
    ]

    # Act
    await repository.write_measurements(measurements)

    # Assert
    mock_influxdb_client.write.assert_called_once()
    points = mock_influxdb_client.write.call_args[0][0]
    assert len(points) == EXPECTED_ITEM_COUNT
    assert points[0]["measurement"] == "test1"
    assert points[0]["tags"] == {"tag1": "value1"}
    assert points[0]["fields"] == {"field1": 1.0}
    assert points[1]["measurement"] == "test2"
    assert points[1]["tags"] == {"tag2": "value2"}
    assert points[1]["fields"] == {"field2": 2.0}


@pytest.mark.asyncio(scope="function")
async def test_write_measurements_error(
    mocker: MockerFixture,
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test error handling in write_measurements."""
    # Arrange
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)
    measurements = [
        Measurement(
            measurement="test1",
            tags={"tag1": "value1"},
            timestamp=datetime.now(UTC),
            fields={"field1": 1.0},
        ),
        Measurement(
            measurement="test2",
            tags={"tag2": "value2"},
            timestamp=datetime.now(UTC),
            fields={"field2": 2.0},
        ),
    ]
    mock_influxdb_client.write.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await repository.write_measurements(measurements)


@pytest.mark.asyncio(scope="function")
async def test_get_latest_timestamp_string_timestamp(
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """get_latest_timestamp should handle ISO8601 string timestamps."""
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)

    iso_ts = "2025-11-22T17:38:04Z"
    mock_influxdb_client.query.return_value = {
        "results": [
            {
                "series": [
                    {
                        "values": [
                            [iso_ts, 1.0],
                        ],
                    }
                ]
            }
        ]
    }

    latest = await repository.get_latest_timestamp("test_measurement")

    assert latest is not None
    assert latest.tzinfo == UTC
    assert latest == datetime(2025, 11, 22, 17, 38, 4, tzinfo=UTC)


@pytest.mark.asyncio(scope="function")
async def test_get_latest_timestamp_epoch_seconds(
    mock_influxdb_client: AsyncMock,
    mock_settings: Settings,
) -> None:
    """get_latest_timestamp should handle integer epoch timestamps in seconds."""
    repository = InfluxDBRepository(settings=mock_settings, client=mock_influxdb_client)

    epoch_seconds = 1_700_000_000
    mock_influxdb_client.query.return_value = {
        "results": [
            {
                "series": [
                    {
                        "values": [
                            [epoch_seconds, 1.0],
                        ],
                    }
                ]
            }
        ]
    }

    latest = await repository.get_latest_timestamp("test_measurement")

    assert latest is not None
    expected = datetime.fromtimestamp(epoch_seconds, tz=UTC)
    assert latest == expected


def test_parse_influx_time_reads_an_rfc3339_string_as_utc() -> None:
    """InfluxDB's default time format, with fractional seconds."""
    expected = datetime(2026, 11, 6, 10, 0, 30, 500000, tzinfo=UTC)
    assert parse_influx_time("2026-11-06T10:00:30.5Z") == expected


@pytest.mark.parametrize(
    "epoch",
    [1793959200, 1793959200000, 1793959200000000, 1793959200000000000],
    ids=["s", "ms", "us", "ns"],
)
def test_parse_influx_time_reads_epochs_of_any_precision(epoch: int) -> None:
    """Epoch values come back in whatever precision the query asked for."""
    assert parse_influx_time(epoch) == datetime(2026, 11, 6, 10, 0, tzinfo=UTC)


def test_parse_influx_time_rejects_other_types() -> None:
    """An unexpected value is reported as unknown, not guessed."""
    assert parse_influx_time(None) is None
