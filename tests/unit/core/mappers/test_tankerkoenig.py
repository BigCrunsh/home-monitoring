"""Unit tests for Tankerkoenig mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.tankerkoenig import TankerkoenigMapper

from tests.unit.constants import EXPECTED_ITEM_COUNT


def test_to_measurements_success() -> None:
    """Test successful mapping of valid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {
        "123": {
            "diesel": 1.599,
            "e5": 1.799,
            "e10": 1.749,
            "status": "open",
        },
        "456": {
            "diesel": 1.619,
            "e5": 1.819,
            "e10": 1.769,
            "status": "closed",
        },
    }
    stations = {
        "123": {
            "brand": "Test Brand 1",
            "street": "Test Street 1",
            "place": "Test Place 1",
        },
        "456": {
            "brand": "Test Brand 2",
            "street": "Test Street 2",
            "place": "Test Place 2",
        },
    }

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    # Assert
    assert len(measurements) == EXPECTED_ITEM_COUNT

    # Check first station
    station1 = measurements[0]
    assert station1.measurement == "gas_prices_euro"
    assert station1.tags["station_id"] == "123"
    assert station1.tags["brand"] == "Test Brand 1"
    assert station1.tags["street"] == "Test Street 1"
    assert station1.tags["place"] == "Test Place 1"
    assert station1.timestamp == timestamp
    assert station1.fields == {
        "e5": 1.799,
        "e10": 1.749,
        "diesel": 1.599,
    }

    # Check second station
    station2 = measurements[1]
    assert station2.measurement == "gas_prices_euro"
    assert station2.tags["station_id"] == "456"
    assert station2.tags["brand"] == "Test Brand 2"
    assert station2.tags["street"] == "Test Street 2"
    assert station2.tags["place"] == "Test Place 2"
    assert station2.timestamp == timestamp
    assert station2.fields == {
        "e5": 1.819,
        "e10": 1.769,
        "diesel": 1.619,
    }


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {
        "123": None,  # Missing price data
        "456": {
            "diesel": 1.619,
            "e5": 1.819,
            "e10": 1.769,
            "status": "closed",
        },
    }
    stations = {
        "123": {
            "brand": "Test Brand 1",
            "street": "Test Street 1",
            "place": "Test Place 1",
        },
        # Missing station 456
    }

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp,
        {"prices": prices, "stations": stations},
    )

    # Assert - should create measurement for station 456 with price data
    # even though station details are missing (uses "unknown" defaults)
    assert len(measurements) == 1
    assert measurements[0].tags["station_id"] == "456"
    assert measurements[0].tags["brand"] == "unknown"
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
