"""Unit tests for Tibber mapper."""
from home_monitoring.core.mappers.tibber import TibberMapper


def test_to_points_success() -> None:
    """Test successful mapping of price data."""
    # Arrange
    price_data = {
        "total": 1.234,
        "energy": 0.567,
        "tax": 0.123,
        "startsAt": "2024-02-16T20:00:00",
        "currency": "NOK",
        "level": "NORMAL",
    }

    # Act
    points = TibberMapper.to_points(price_data)

    # Assert
    assert len(points) == 1
    assert points[0]["measurement"] == "electricity_prices"
    assert points[0]["tags"]["currency"] == "NOK"
    assert points[0]["tags"]["level"] == "NORMAL"
    assert points[0]["time"] == "2024-02-16T20:00:00"
    assert points[0]["fields"]["total"] == 1.234
    assert points[0]["fields"]["energy"] == 0.567
    assert points[0]["fields"]["tax"] == 0.123


def test_to_points_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    price_data = {}

    # Act
    points = TibberMapper.to_points(price_data)

    # Assert
    assert len(points) == 1
    assert points[0]["tags"]["currency"] == "unknown"
    assert points[0]["tags"]["level"] == "unknown"
    assert points[0]["fields"]["total"] == 0.0
    assert points[0]["fields"]["energy"] == 0.0
    assert points[0]["fields"]["tax"] == 0.0


def test_to_points_invalid_data() -> None:
    """Test handling of invalid data."""
    # Arrange
    price_data = {
        "total": "invalid",
        "energy": None,
        "tax": "0.123",
        "startsAt": None,
        "currency": 123,
        "level": None,
    }

    # Act
    points = TibberMapper.to_points(price_data)

    # Assert
    assert len(points) == 1
    assert points[0]["tags"]["currency"] == "unknown"
    assert points[0]["tags"]["level"] == "unknown"
    assert points[0]["fields"]["total"] == 0.0
    assert points[0]["fields"]["energy"] == 0.0
    assert points[0]["fields"]["tax"] == 0.0
