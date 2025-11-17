"""Unit tests for Gardena mapper."""

from datetime import UTC, datetime
from unittest.mock import Mock

from home_monitoring.core.mappers.gardena import GardenaMapper


def test_control_data_to_points() -> None:
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
    points = GardenaMapper.control_data_to_points(device, timestamp)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point["measurement"] == "gardena"
    assert point["tags"] == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SMART_IRRIGATION_CONTROL",
    }
    assert point["time"] == timestamp.isoformat()
    assert point["fields"] == {
        "state": "test-state",
        "activity": "test-activity",
    }


def test_sensor_data_to_points() -> None:
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
    points = GardenaMapper.sensor_data_to_points(device, timestamp)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point["measurement"] == "gardena"
    assert point["tags"] == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
    }
    assert point["time"] == timestamp.isoformat()
    assert point["fields"] == {
        "ambient_temperature": 20.0,
        "light_intensity": 5000,
        "soil_temperature": 18.0,
        "soil_humidity": 75.0,
    }


def test_soil_sensor_data_to_points() -> None:
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
    points = GardenaMapper.soil_sensor_data_to_points(device, timestamp)

    # Assert
    assert len(points) == 1
    point = points[0]
    assert point["measurement"] == "gardena"
    assert point["tags"] == {
        "device_id": "test-id",
        "name": "test-device",
        "type": "SOIL_SENSOR",
    }
    assert point["time"] == timestamp.isoformat()
    assert point["fields"] == {
        "soil_temperature": 18.0,
        "soil_humidity": 75.0,
    }
