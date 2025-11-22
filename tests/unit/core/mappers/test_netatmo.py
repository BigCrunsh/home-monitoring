"""Unit tests for Netatmo mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.netatmo import NetatmoMapper

EXPECTED_TOTAL_POINTS = 7
EXPECTED_BASE_POINTS = 5
EXPECTED_MODULE_POINTS = 2
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
    assert len(points) == EXPECTED_TOTAL_POINTS

    # Split points by module_name for easier assertions
    base_points = [p for p in points if p.tags["module_name"] == "Test Device"]
    module_points = [p for p in points if p.tags["module_name"] == "Test Module"]

    assert len(base_points) == EXPECTED_BASE_POINTS
    assert len(module_points) == EXPECTED_MODULE_POINTS

    base_by_measurement = {p.measurement: p for p in base_points}
    module_by_measurement = {p.measurement: p for p in module_points}

    # Base station metrics
    temp_base = base_by_measurement["weather_temperature_celsius"]
    assert temp_base.tags == {
        "module_name": "Test Device",
        "device_id": "test-device",
        "type": "NAMain",
    }
    assert temp_base.timestamp == timestamp
    assert temp_base.fields == {"Temperature": 20.5}

    humidity_base = base_by_measurement["weather_humidity_percentage"]
    assert humidity_base.tags == {
        "module_name": "Test Device",
        "device_id": "test-device",
        "type": "NAMain",
    }
    assert humidity_base.timestamp == timestamp
    assert humidity_base.fields == {"Humidity": 50.0}

    co2_base = base_by_measurement["weather_co2_ppm"]
    assert co2_base.tags == {
        "module_name": "Test Device",
        "device_id": "test-device",
        "type": "NAMain",
    }
    assert co2_base.timestamp == timestamp
    assert co2_base.fields == {"CO2": 800.0}

    pressure_base = base_by_measurement["weather_pressure_mbar"]
    assert pressure_base.tags == {
        "module_name": "Test Device",
        "device_id": "test-device",
        "type": "NAMain",
    }
    assert pressure_base.timestamp == timestamp
    assert pressure_base.fields == {"Pressure": 1015.2}

    noise_base = base_by_measurement["weather_noise_db"]
    assert noise_base.tags == {
        "module_name": "Test Device",
        "device_id": "test-device",
        "type": "NAMain",
    }
    assert noise_base.timestamp == timestamp
    assert noise_base.fields == {"Noise": 45.0}

    # Module metrics
    temp_module = module_by_measurement["weather_temperature_celsius"]
    assert temp_module.tags == {
        "module_name": "Test Module",
        "device_id": "test-module",
        "type": "NAModule1",
    }
    assert temp_module.timestamp == timestamp
    assert temp_module.fields == {"Temperature": 18.5}

    humidity_module = module_by_measurement["weather_humidity_percentage"]
    assert humidity_module.tags == {
        "module_name": "Test Module",
        "device_id": "test-module",
        "type": "NAModule1",
    }
    assert humidity_module.timestamp == timestamp
    assert humidity_module.fields == {"Humidity": 55.0}


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
