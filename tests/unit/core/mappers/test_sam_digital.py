"""Unit tests for Sam Digital mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.sam_digital import SamDigitalMapper

EXPECTED_SAM_MEASUREMENT_COUNT = 4


def test_to_measurements_success() -> None:
    """Test successful mapping of Sam Digital devices data."""
    timestamp = datetime(2024, 2, 16, 20, 0, 0, tzinfo=UTC)
    devices = [
        {
            "id": "device1",
            "name": "Test Device",
            "data": [
                {"id": "MBR_10", "value": 5.0},
                {"id": "MBR_18", "value": 35.5},
                {"id": "MBR_23", "value": 45.0},
                {"id": "MBR_109", "value": 75.0},
            ],
        }
    ]

    measurements = SamDigitalMapper.to_measurements(timestamp, devices)

    assert len(measurements) == EXPECTED_SAM_MEASUREMENT_COUNT

    names = {m.measurement for m in measurements}
    assert names == {
        "heat_outdoor_temperature_celsius",
        "heat_return_temperature_celsius",
        "heat_storage_temperature_celsius",
        "heat_valve_signal_percentage",
    }

    for m in measurements:
        assert m.timestamp == timestamp
        assert m.tags["id"] in {"MBR_10", "MBR_18", "MBR_23", "MBR_109"}
        assert "label" in m.tags
        assert len(m.fields) == 1


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
