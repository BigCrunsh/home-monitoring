"""Unit tests for Techem mapper."""
from datetime import datetime

from home_monitoring.core.mappers.techem import TechemMapper


def test_to_points_success() -> None:
    """Test successful mapping of meter data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = [
        b"b4449244426c1002426c4d230000441302fd6700000000046d280c5929",
    ]

    # Act
    points = TechemMapper.to_points(timestamp, responses)

    # Assert
    assert len(points) == 1
    assert points[0]["measurement"] == "techem"
    assert isinstance(points[0]["tags"]["meter_id"], str)
    assert isinstance(points[0]["tags"]["type"], str)
    assert points[0]["time"] == timestamp.isoformat()
    assert isinstance(points[0]["fields"]["value"], float)


def test_to_points_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    responses = []

    # Act
    points = TechemMapper.to_points(timestamp, responses)

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
    points = TechemMapper.to_points(timestamp, responses)

    # Assert
    assert len(points) == 0
