"""Unit tests for Techem mapper."""

from datetime import datetime

from home_monitoring.core.mappers.techem import TechemMapper


def test_to_measurements_success() -> None:
    """Test successful mapping of meter data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = [
        b"36446850532301534362000000000000fd000000000000",
    ]

    # Act
    measurements = TechemMapper.to_measurements(timestamp, responses)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "heat_energy_watthours"
    assert measurement.tags == {
        "id": "53012353",
    }
    assert measurement.timestamp == timestamp
    assert measurement.fields == {
        "Total_Consumption": 0.253,
    }


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = []

    # Act
    points = TechemMapper.to_measurements(timestamp, responses)

    # Assert
    assert len(points) == 0


def test_to_measurements_invalid_data() -> None:
    """Test handling of invalid data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = [
        b"invalid data",
    ]

    # Act
    points = TechemMapper.to_measurements(timestamp, responses)

    # Assert
    assert len(points) == 0
