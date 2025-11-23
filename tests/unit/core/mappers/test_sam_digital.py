"""Unit tests for Sam Digital mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.sam_digital import SamDigitalMapper

EXPECTED_SAM_MEASUREMENT_COUNT = 2
EXPECTED_SAM_NUMERIC_STRING_COUNT = 1


def test_to_measurements_success() -> None:
    """Test successful mapping of Sam Digital devices data."""
    timestamp = datetime(2024, 2, 16, 20, 0, 0, tzinfo=UTC)
    devices = [
        {
            "id": "device1",
            "name": "Test Device",
            "data": [
                {"id": "MBR_10", "value": 5.0},
                {"id": "MBR_13", "value": 40.0},
                {"id": "MBR_17", "value": 41.0},
                {"id": "MBR_18", "value": 35.5},
                {"id": "MBR_23", "value": 45.0},
                {"id": "MBR_107", "value": 10.0},
                {"id": "MBR_109", "value": 75.0},
            ],
        }
    ]

    measurements = SamDigitalMapper.to_measurements(timestamp, devices)

    assert len(measurements) == EXPECTED_SAM_MEASUREMENT_COUNT

    names = {m.measurement for m in measurements}
    assert names == {
        "heat_temperature_celsius",
        "heat_valve_signal_percentage",
    }

    temp = next(m for m in measurements if m.measurement == "heat_temperature_celsius")
    valve = next(
        m for m in measurements if m.measurement == "heat_valve_signal_percentage"
    )

    assert temp.timestamp == timestamp
    assert valve.timestamp == timestamp

    assert set(temp.fields.keys()) == {
        "outdoor",
        "heating_flow",
        "heating_return",
        "hotwater_return",
        "hotwater_storage",
    }
    assert set(valve.fields.keys()) == {"heating", "hotwater"}

    assert temp.tags["device_id"] == "device1"
    assert temp.tags["device_name"] == "Test Device"


def test_to_measurements_accepts_numeric_strings() -> None:
    """Numeric string values from API should be converted to floats."""
    timestamp = datetime.now(UTC)
    devices = [
        {
            "id": "device1",
            "data": [
                {"id": "MBR_10", "value": "5.0"},
                {"id": "MBR_18", "value": "35.5"},
            ],
        }
    ]

    measurements = SamDigitalMapper.to_measurements(timestamp, devices)

    assert len(measurements) == EXPECTED_SAM_NUMERIC_STRING_COUNT
    names = {m.measurement for m in measurements}
    assert names == {"heat_temperature_celsius"}

    temp = measurements[0]
    assert set(temp.fields.keys()) == {"outdoor", "hotwater_return"}


def test_to_measurements_ignores_unknown_ids() -> None:
    """Unknown datapoint IDs should be ignored."""
    timestamp = datetime.now(UTC)
    devices = [
        {
            "id": "device1",
            "data": [
                {"id": "UNKNOWN", "value": 1.0},
            ],
        }
    ]

    measurements = SamDigitalMapper.to_measurements(timestamp, devices)

    assert measurements == []


def test_to_measurements_ignores_non_numeric_values() -> None:
    """Non-numeric datapoint values should be ignored."""
    timestamp = datetime.now(UTC)
    devices = [
        {
            "id": "device1",
            "data": [
                {"id": "MBR_10", "value": "not-a-number"},
            ],
        }
    ]

    measurements = SamDigitalMapper.to_measurements(timestamp, devices)

    assert measurements == []
