"""Unit tests for Tankerkoenig mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.tankerkoenig import TankerkoenigMapper


def test_to_measurements_success() -> None:
    """Test successful mapping of valid data with open station."""
    timestamp = datetime.now(UTC)
    prices = {
        "123": {
            "diesel": 1.599,
            "e5": 1.799,
            "e10": 1.749,
            "status": "open",
        },
    }
    stations = {
        "123": {
            "brand": "Test Brand 1",
            "street": "Test Street 1",
            "place": "Test Place 1",
        },
    }

    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    assert len(measurements) == 1

    station = measurements[0]
    assert station.measurement == "gas_prices_euro"
    assert station.tags["station_id"] == "123"
    assert station.tags["brand"] == "Test Brand 1"
    assert station.tags["street"] == "Test Street 1"
    assert station.tags["place"] == "Test Place 1"
    assert station.timestamp == timestamp
    assert station.fields == {
        "e5": 1.799,
        "e10": 1.749,
        "diesel": 1.599,
    }


def test_to_measurements_closed_station() -> None:
    """Test that closed stations are skipped."""
    timestamp = datetime.now(UTC)
    prices = {
        "123": {
            "diesel": 1.619,
            "e5": 1.819,
            "e10": 1.769,
            "status": "closed",
        },
    }
    stations = {
        "123": {
            "brand": "Test Brand",
            "street": "Test Street",
            "place": "Test Place",
        },
    }

    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    assert len(measurements) == 0


def test_to_measurements_zero_prices() -> None:
    """Test that stations with all zero prices are skipped."""
    timestamp = datetime.now(UTC)
    prices = {
        "123": {
            "diesel": 0.0,
            "e5": 0.0,
            "e10": 0.0,
            "status": "open",
        },
    }
    stations = {
        "123": {
            "brand": "Test Brand",
            "street": "Test Street",
            "place": "Test Place",
        },
    }

    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    assert len(measurements) == 0


def test_to_measurements_missing_data() -> None:
    """Test handling of missing price data."""
    timestamp = datetime.now(UTC)
    prices = {
        "123": None,
        "456": {
            "diesel": 1.619,
            "e5": 1.819,
            "e10": 1.769,
            "status": "open",
        },
    }
    stations = {
        "456": {
            "brand": "Test Brand",
            "street": "Test Street",
            "place": "Test Place",
        },
    }

    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    assert len(measurements) == 1
    assert measurements[0].tags["station_id"] == "456"
    assert measurements[0].tags["brand"] == "Test Brand"
    expected_diesel_price = 1.619
    assert measurements[0].fields["diesel"] == expected_diesel_price


def test_to_measurements_invalid_data() -> None:
    """Test handling of invalid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {}  # Empty prices
    stations = {}  # Empty stations

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    # Assert
    assert len(measurements) == 0
