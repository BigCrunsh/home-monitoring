"""Unit tests for Tankerkoenig mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.tankerkoenig import TankerkoenigMapper

from tests.unit.core.mappers.constants import (
    EXPECTED_POINT_COUNT,
    TANKERKOENIG_DIESEL_1,
    TANKERKOENIG_DIESEL_2,
    TANKERKOENIG_E5_1,
    TANKERKOENIG_E5_2,
    TANKERKOENIG_E10_1,
    TANKERKOENIG_E10_2,
)


def test_to_measurements_success() -> None:
    """Test successful mapping of valid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {
        "prices": {
            "123": {
                "diesel": TANKERKOENIG_DIESEL_1,
                "e5": TANKERKOENIG_E5_1,
                "e10": TANKERKOENIG_E10_1,
                "status": "open",
            },
            "456": {
                "diesel": TANKERKOENIG_DIESEL_2,
                "e5": TANKERKOENIG_E5_2,
                "e10": TANKERKOENIG_E10_2,
                "status": "closed",
            },
        }
    }
    stations = {
        "123": {
            "name": "Test Station 1",
            "brand": "Test Brand 1",
            "street": "Test Street 1",
            "place": "Test Place 1",
            "postCode": "12345",
        },
        "456": {
            "name": "Test Station 2",
            "brand": "Test Brand 2",
            "street": "Test Street 2",
            "place": "Test Place 2",
            "postCode": "67890",
        },
    }

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp, prices, stations
    )

    # Assert
    assert len(measurements) == EXPECTED_POINT_COUNT

    # Check first station
    station1 = measurements[0]
    assert station1.measurement == "gas_prices"
    assert station1.tags == {
        "station_id": "123",
        "name": "Test Station 1",
        "brand": "Test Brand 1",
        "street": "Test Street 1",
        "place": "Test Place 1",
        "post_code": "12345",
    }
    assert station1.timestamp == timestamp
    assert station1.fields == {
        "diesel": TANKERKOENIG_DIESEL_1,
        "e5": TANKERKOENIG_E5_1,
        "e10": TANKERKOENIG_E10_1,
        "is_open": True,
    }

    # Check second station
    station2 = measurements[1]
    assert station2.measurement == "gas_prices"
    assert station2.tags == {
        "station_id": "456",
        "name": "Test Station 2",
        "brand": "Test Brand 2",
        "street": "Test Street 2",
        "place": "Test Place 2",
        "post_code": "67890",
    }
    assert station2.timestamp == timestamp
    assert station2.fields == {
        "diesel": TANKERKOENIG_DIESEL_2,
        "e5": TANKERKOENIG_E5_2,
        "e10": TANKERKOENIG_E10_2,
        "is_open": False,
    }


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {
        "prices": {
            "123": None,  # Missing price data
            "456": {
                "diesel": TANKERKOENIG_DIESEL_2,
                "e5": TANKERKOENIG_E5_2,
                "e10": TANKERKOENIG_E10_2,
                "status": "closed",
            },
        }
    }
    stations = {
        "123": {
            "name": "Test Station 1",
            "brand": "Test Brand 1",
            "street": "Test Street 1",
            "place": "Test Place 1",
            "postCode": "12345",
        },
        # Missing station 456
    }

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp, prices, stations
    )

    # Assert
    assert len(measurements) == 0


def test_to_measurements_invalid_data() -> None:
    """Test handling of invalid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    prices = {}  # Empty prices
    stations = {}  # Empty stations

    # Act
    measurements = TankerkoenigMapper.to_measurements(
        timestamp, prices, stations
    )

    # Assert
    assert len(measurements) == 0
