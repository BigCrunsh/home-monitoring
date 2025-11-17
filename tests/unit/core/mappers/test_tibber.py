"""Unit tests for Tibber mapper."""

from datetime import datetime

from home_monitoring.core.mappers.tibber import TibberMapper

from tests.unit.core.mappers.constants import (
    TIBBER_CONSUMPTION,
    TIBBER_COST,
    TIBBER_PRODUCTION,
    ZERO,
)


def test_to_measurements_success() -> None:
    """Test successful mapping of price data."""
    # Arrange
    price_data = {
        "total": TIBBER_CONSUMPTION,
        "energy": TIBBER_PRODUCTION,
        "tax": TIBBER_COST,
        "startsAt": "2024-02-16T20:00:00",
        "currency": "NOK",
        "level": "NORMAL",
    }

    # Act
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    points = TibberMapper.to_measurements(timestamp, price_data)

    # Assert
    assert len(points) == 1
    assert points[0].measurement == "electricity_prices"
    assert points[0].tags["currency"] == "NOK"
    assert points[0].tags["level"] == "NORMAL"
    assert points[0].timestamp == datetime(2024, 2, 16, 20, 0, 0)
    assert points[0].fields["total"] == TIBBER_CONSUMPTION
    assert points[0].fields["energy"] == TIBBER_PRODUCTION
    assert points[0].fields["tax"] == TIBBER_COST


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    price_data = {}

    # Act
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    points = TibberMapper.to_measurements(timestamp, price_data)

    # Assert
    assert len(points) == 1
    assert points[0].tags["currency"] == "unknown"
    assert points[0].tags["level"] == "unknown"
    assert points[0].fields["total"] == ZERO
    assert points[0].fields["energy"] == ZERO
    assert points[0].fields["tax"] == ZERO


def test_to_measurements_invalid_data() -> None:
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
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    points = TibberMapper.to_measurements(timestamp, price_data)

    # Assert
    assert len(points) == 1
    assert points[0].tags["currency"] == "unknown"
    assert points[0].tags["level"] == "unknown"
    assert points[0].fields["total"] == ZERO
    assert points[0].fields["energy"] == ZERO
    assert points[0].fields["tax"] == ZERO
