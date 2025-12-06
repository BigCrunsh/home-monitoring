"""Unit tests for Tibber mapper.

Tests cover:
- Price data mapping (default data_type)
- Cost data mapping (data_type="cost")
- Consumption data mapping (data_type="consumption")
"""

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


# Tests for cost measurements (data_type="cost")
def test_to_cost_measurement_last_hour() -> None:
    """Test cost measurement mapping for last hour."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"cost": 0.45, "period": "last_hour"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_costs_euro"
    assert measurement.tags == {"period": "last_hour"}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {"cost": 0.45}


def test_to_cost_measurement_yesterday() -> None:
    """Test cost measurement mapping for yesterday."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"cost": 7.65, "period": "yesterday"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_costs_euro"
    assert measurement.tags == {"period": "yesterday"}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {"cost": 7.65}



def test_to_cost_measurement_zero_cost() -> None:
    """Test cost measurement with zero cost (unhappy path)."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"cost": 0.0, "period": "last_hour"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    assert measurements[0].fields == {"cost": 0.0}


# Tests for consumption measurements (data_type="consumption")
def test_to_consumption_measurement_last_hour() -> None:
    """Test consumption measurement mapping for last hour."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"consumption": 1.5, "period": "last_hour"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_consumption_kwh"
    assert measurement.tags == {"period": "last_hour"}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {"consumption": 1.5}


def test_to_consumption_measurement_yesterday() -> None:
    """Test consumption measurement mapping for yesterday."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"consumption": 25.5, "period": "yesterday"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_consumption_kwh"
    assert measurement.tags == {"period": "yesterday"}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {"consumption": 25.5}


def test_to_consumption_measurement_last_year() -> None:
    """Test consumption measurement mapping for last year."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"consumption": 36.0, "period": "last_year"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    measurement = measurements[0]
    assert measurement.measurement == "electricity_consumption_kwh"
    assert measurement.tags == {"period": "last_year"}
    assert measurement.timestamp == timestamp
    assert measurement.fields == {"consumption": 36.0}


def test_to_consumption_measurement_zero_consumption() -> None:
    """Test consumption measurement with zero consumption (unhappy path)."""
    # Arrange
    timestamp = datetime(2024, 2, 16, 20, 0, 0)
    data = {"consumption": 0.0, "period": "last_hour"}

    # Act
    measurements = TibberMapper.to_measurements(timestamp, data)

    # Assert
    assert len(measurements) == 1
    assert measurements[0].fields == {"consumption": 0.0}
