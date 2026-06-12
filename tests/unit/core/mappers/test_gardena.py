"""Unit tests for Gardena mapper."""

from datetime import UTC, datetime
from unittest.mock import Mock

from home_monitoring.core.mappers.gardena import GardenaMapper

EXPECTED_SENSOR_MEASUREMENT_COUNT = 5
EXPECTED_SOIL_SENSOR_MEASUREMENT_COUNT = 2


def test_to_measurements_control_data() -> None:
    """Irrigation control maps one row per valve, state=1 only when watering."""
    # Arrange: a controller with two valves — one watering, one closed
    device = Mock(spec=["id", "name", "type", "valves"])
    device.id = "test-id"
    device.name = "Bewässerung"
    device.type = "SMART_IRRIGATION_CONTROL"
    device.valves = {
        "v1": {
            "id": "v1",
            "name": "Vorgarten",
            "activity": "SCHEDULED_WATERING",
            "state": "OK",
        },
        "v2": {"id": "v2", "name": "Hochbeet", "activity": "CLOSED", "state": "OK"},
    }
    timestamp = datetime.now(UTC)

    # Act
    measurements = GardenaMapper.to_measurements(timestamp, device)

    # Assert: one measurement per valve, named, with the right active state
    assert len(measurements) == 2
    by_zone = {m.tags["valve_name"]: m for m in measurements}
    assert all(m.measurement == "garden_valves_activity" for m in measurements)
    assert by_zone["Vorgarten"].tags["activity"] == "SCHEDULED_WATERING"
    assert by_zone["Vorgarten"].fields == {"state": 1}
    assert by_zone["Hochbeet"].fields == {"state": 0}


def test_to_measurements_control_no_valves() -> None:
    """A controller with no valves yields no rows (unhappy path)."""
    device = Mock(spec=["id", "name", "type", "valves"])
    device.id = "c"
    device.name = "Bewässerung"
    device.type = "SMART_IRRIGATION_CONTROL"
    device.valves = {}

    measurements = GardenaMapper.to_measurements(datetime.now(UTC), device)

    assert measurements == []


def test_to_measurements_sensor_data() -> None:
    """Test mapping of sensor data."""
    # Arrange
    device = Mock()
    device.id = "test-id"
    device.name = "test-device"
    device.type = "SENSOR"
    device.ambient_temperature = 20.0
    device.light_intensity = 5000
    device.soil_humidity = 75.0
    device.rf_link_level = 42.0
    device.battery_level = 90.0
    timestamp = datetime.now(UTC)

    # Act
    measurements = GardenaMapper.to_measurements(timestamp, device)

    # Assert
    assert len(measurements) == EXPECTED_SENSOR_MEASUREMENT_COUNT

    measurements_by_name = {m.measurement: m for m in measurements}

    temperature = measurements_by_name["garden_temperature_celsius"]
    assert temperature.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
        "environment": "ambient",
    }
    assert temperature.timestamp == timestamp
    assert temperature.fields == {"temperature": 20.0}

    humidity = measurements_by_name["garden_humidity_percentage"]
    assert humidity.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
        "environment": "soil",
    }
    assert humidity.timestamp == timestamp
    assert humidity.fields == {"humidity": 75.0}

    light = measurements_by_name["garden_light_intensity_lux"]
    assert light.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
    }
    assert light.timestamp == timestamp
    assert light.fields == {"light_intensity": 5000.0}

    rf_link = measurements_by_name["garden_rf_link_level_percentage"]
    assert rf_link.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
    }
    assert rf_link.timestamp == timestamp
    assert rf_link.fields == {"rf_link_level": 42.0}

    battery = measurements_by_name["garden_system_battery_percentage"]
    assert battery.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SENSOR",
    }
    assert battery.timestamp == timestamp
    assert battery.fields == {"battery_level": 90.0}


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
    measurements = GardenaMapper.to_measurements(timestamp, device)

    # Assert
    assert len(measurements) == EXPECTED_SOIL_SENSOR_MEASUREMENT_COUNT

    measurements_by_name = {m.measurement: m for m in measurements}

    temperature = measurements_by_name["garden_temperature_celsius"]
    assert temperature.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SOIL_SENSOR",
        "environment": "soil",
        "sensor_type": "soil",
    }
    assert temperature.timestamp == timestamp
    assert temperature.fields == {"temperature": 18.0}

    humidity = measurements_by_name["garden_humidity_percentage"]
    assert humidity.tags == {
        "id": "test-id",
        "name": "test-device",
        "type": "SOIL_SENSOR",
        "environment": "soil",
    }
    assert humidity.timestamp == timestamp
    assert humidity.fields == {"humidity": 75.0}
