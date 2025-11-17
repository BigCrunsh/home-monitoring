"""Unit tests for Techem mapper."""

from datetime import datetime

from home_monitoring.core.mappers.techem import TechemMapper


def test_to_points_success() -> None:
    """Test successful mapping of meter data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = [
        b"36446850532301534362000000000000fd000000000000",
    ]

    # Act
    points = TechemMapper.to_measurements(timestamp, responses)

    # Assert
    assert len(points) == 1
    assert points[0].measurement == "techem"
    assert points[0].tags == {
        "meter_id": "53012353",
        "type": "00",
    }
    assert points[0].timestamp == timestamp
    assert points[0].fields == {
        "value": 0.253,
    }


def test_to_points_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = []

    # Act
    points = TechemMapper.to_measurements(timestamp, responses)

    # Assert
    assert len(points) == 0


def test_to_points_invalid_data() -> None:
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
