"""Unit tests for Netatmo mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.netatmo import NetatmoMapper

from tests.unit.core.mappers.constants import EXPECTED_POINT_COUNT


def test_to_measurements_success() -> None:
    """Test successful mapping of valid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    devices = [
        {
            "_id": "test-device",
            "module_name": "Test Device",
            "type": "NAMain",
            "dashboard_data": {
                "Temperature": 20.5,
                "Humidity": 50,
                "CO2": 800,
                "Pressure": 1015.2,
                "Noise": 45,
            },
            "modules": [
                {
                    "_id": "test-module",
                    "module_name": "Test Module",
                    "type": "NAModule1",
                    "dashboard_data": {
                        "Temperature": 18.5,
                        "Humidity": 55,
                    },
                }
            ],
        }
    ]

    # Act
    points = NetatmoMapper.to_measurements(timestamp, devices)

    # Assert
    assert len(points) == EXPECTED_POINT_COUNT

    # Check base station point
    base_point = points[0]
    assert base_point.measurement == "netatmo"
    assert base_point.tags == {
        "device_id": "test-device",
        "type": "NAMain",
        "module_name": "Test Device",
    }
    assert base_point.timestamp == timestamp
    assert base_point.fields == {
        "Temperature": 20.5,
        "Humidity": 50,
        "CO2": 800,
        "Pressure": 1015.2,
        "Noise": 45,
    }

    # Check module point
    module_point = points[1]
    assert module_point.measurement == "netatmo"
    assert module_point.tags == {
        "device_id": "test-module",
        "type": "NAModule1",
        "module_name": "Test Module",
    }
    assert module_point.timestamp == timestamp
    assert module_point.fields == {
        "Temperature": 18.5,
        "Humidity": 55,
    }


def test_to_measurements_missing_data() -> None:
    """Test handling of missing data."""
    # Arrange
    timestamp = datetime.now(UTC)
    devices = [
        {
            "_id": "test-device",
            "module_name": "Test Device",
            "type": "NAMain",
            # Missing dashboard_data
            "modules": [
                {
                    "_id": "test-module",
                    "module_name": "Test Module",
                    "type": "NAModule1",
                    # Missing dashboard_data
                }
            ],
        }
    ]

    # Act
    points = NetatmoMapper.to_measurements(timestamp, devices)

    # Assert
    assert len(points) == 0


def test_to_measurements_invalid_data() -> None:
    """Test handling of invalid data."""
    # Arrange
    timestamp = datetime.now(UTC)
    devices = [
        {
            # Missing required fields
            "dashboard_data": {
                "Temperature": "invalid",  # Invalid type
                "Humidity": None,  # Invalid value
            },
        }
    ]

    # Act
    points = NetatmoMapper.to_measurements(timestamp, devices)

    # Assert
    assert len(points) == 0
