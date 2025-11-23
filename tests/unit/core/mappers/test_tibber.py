"""Unit tests for Tibber mapper."""

from datetime import datetime

from home_monitoring.core.mappers.tibber import TibberMapper

from tests.unit.core.mappers.constants import (
    TIBBER_CONSUMPTION,
    ZERO,
)


def test_to_measurements_success() -> None:
    """Test successful mapping of price data."""
    # Arrange
    price_data = {
        "total": TIBBER_CONSUMPTION,
        "startsAt": "2024-02-16T20:00:00",
        "currency": "EUR",
        "level": "NORMAL",
    }

    # Act
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    measurements = TibberMapper.to_measurements(timestamp, price_data)

    # Assert - expect single EUR measurement
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_prices_euro"
    assert measurement.tags == {}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {
        "total": TIBBER_CONSUMPTION,
        "rank": 0.5,
    }


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    price_data = {}

    # Act
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    measurements = TibberMapper.to_measurements(timestamp, price_data)

    # Assert - defaults for missing data
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_prices_euro"
    assert measurement.tags == {}
    assert measurement.fields == {
        "total": ZERO,
        "rank": 0.5,
    }


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
    measurements = TibberMapper.to_measurements(timestamp, price_data)

    # Assert - invalid data should fall back to defaults
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_prices_euro"
    assert measurement.tags == {}
    assert measurement.fields == {
        "total": ZERO,
        "rank": 0.5,
    }
