"""Unit tests for Gardena mapper."""

from datetime import UTC, datetime
from unittest.mock import Mock

from home_monitoring.core.mappers.gardena import GardenaMapper


def test_to_measurements_control_data() -> None:
    """Test mapping of irrigation control data."""
    # Arrange
    device = Mock()
    device.id = "test-id"
    device.name = "test-device"
    device.type = "SMART_IRRIGATION_CONTROL"
    device.state = "test-state"
    device.activity = "test-activity"
    timestamp = datetime.now(UTC)

    # Act
    points = GardenaMapper.to_measurements(timestamp, device)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point.measurement == "gardena"
    assert point.tags == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SMART_IRRIGATION_CONTROL",
    }
    assert point.timestamp == timestamp
    assert point.fields == {
        "state": "test-state",
        "activity": "test-activity",
    }


def test_to_measurements_sensor_data() -> None:
    """Test mapping of sensor data."""
    # Arrange
    device = Mock()
    device.id = "test-id"
    device.name = "test-device"
    device.type = "SENSOR"
    device.ambient_temperature = 20.0
    device.light_intensity = 5000
    device.soil_temperature = 18.0
    device.soil_humidity = 75.0
    timestamp = datetime.now(UTC)

    # Act
    points = GardenaMapper.to_measurements(timestamp, device)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point.measurement == "gardena"
    assert point.tags == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
    }
    assert point.timestamp == timestamp
    assert point.fields == {
        "ambient_temperature": 20.0,
        "light_intensity": 5000,
        "soil_temperature": 18.0,
        "soil_humidity": 75.0,
    }


def test_to_measurements_soil_sensor_data() -> None:
    """Test mapping of soil sensor data."""
    # Arrange
    device = Mock()
    device.id = "test-id"
    device.name = "test-device"
    device.type = "SOIL_SENSOR"
    device.soil_temperature = 18.0
    device.soil_humidity = 75.0
    timestamp = datetime.now(UTC)

    # Act
    points = GardenaMapper.to_measurements(timestamp, device)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point.measurement == "gardena"
    assert point.tags == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SOIL_SENSOR",
    }
    assert point.timestamp == timestamp
    assert point.fields == {
        "soil_temperature": 18.0,
        "soil_humidity": 75.0,
    }
