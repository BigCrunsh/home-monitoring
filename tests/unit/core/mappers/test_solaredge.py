"""Unit tests for SolarEdge mapper."""

from datetime import UTC, datetime

from home_monitoring.core.mappers.solaredge import SolarEdgeMapper

EXPECTED_POWER_DETAIL_POINTS = 2


def test_power_details_to_measurements_success() -> None:
    """Test successful mapping of powerDetails data."""
    power_details = {
        "powerDetails": {
            "timeUnit": "QUARTER_OF_AN_HOUR",
            "unit": "W",
            "meters": [
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
                {
                    "type": "Purchased",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 619.8288},
                        {"date": "2015-11-21 11:15:00", "value": 474.87576},
                    ],
                },
                {
                    "type": "Production",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 0},
                        {"date": "2015-11-21 11:15:00", "value": 0},
                    ],
                },
                {
                    "type": "SelfConsumption",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 0},
                        {"date": "2015-11-21 11:15:00", "value": 0},
                    ],
                },
                {
                    "type": "FeedIn",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 0},
                        {"date": "2015-11-21 11:15:00", "value": 0},
                    ],
                },
            ],
        }
    }

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        power_details,
        site_id="1",
    )

    assert len(points) == EXPECTED_POWER_DETAIL_POINTS

    first = points[0]
    assert first.measurement == "electricity_power_watt"
    assert first.tags["site_id"] == "1"
    assert first.timestamp == datetime(2015, 11, 21, 11, 0, 0)
    assert first.fields == {
        "FeedIn": 0.0,
        "SelfConsumption": 0.0,
        "Purchased": 619.8288,
        "Consumption": 619.8288,
        "Production": 0.0,
    }


def test_power_details_to_measurements_missing_root() -> None:
    """Test handling of missing powerDetails root element."""
    power_details: dict = {}

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        power_details,
        site_id="1",
    )

    assert points == []


def test_energy_details_to_measurements_success() -> None:
    """Test successful mapping of energyDetails data."""
    energy_details = {
        "energyDetails": {
            "timeUnit": "WEEK",
            "unit": "Wh",
            "meters": [
                {
                    "type": "Production",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 2953},
                    ],
                },
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 29885},
                    ],
                },
            ],
        }
    }

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        energy_details,
        site_id="1",
    )

    assert len(points) == 1

    point = points[0]
    assert point.measurement == "electricity_energy_watthour"
    assert point.tags["site_id"] == "1"
    assert point.timestamp == datetime(2015, 11, 16, 0, 0, 0)
    assert point.fields == {
        "FeedIn": 0.0,
        "SelfConsumption": 0.0,
        "Purchased": 0.0,
        "Consumption": 29885.0,
        "Production": 2953.0,
    }


def test_energy_details_to_measurements_missing_root() -> None:
    """Test handling of missing energyDetails root element."""
    energy_details: dict = {}

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        energy_details,
        site_id="1",
    )

    assert points == []


def test_energy_details_to_measurements_invalid_unit() -> None:
    """Test handling of unsupported units in energyDetails."""
    energy_details = {
        "energyDetails": {
            "timeUnit": "WEEK",
            "unit": "kWh",
            "meters": [
                {
                    "type": "Production",
                    "values": [
                        {"date": "2015-11-16 00:00:00", "value": 2953},
                    ],
                }
            ],
        }
    }

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        energy_details,
        site_id="1",
    )

    assert points == []


def test_power_details_to_measurements_invalid_unit() -> None:
    """Test handling of unsupported units in powerDetails."""
    power_details = {
        "powerDetails": {
            "timeUnit": "QUARTER_OF_AN_HOUR",
            "unit": "kW",
            "meters": [
                {
                    "type": "Consumption",
                    "values": [
                        {"date": "2015-11-21 11:00:00", "value": 100.0},
                    ],
                }
            ],
        }
    }

    points = SolarEdgeMapper.to_measurements(
        datetime.now(UTC),
        power_details,
        site_id="1",
    )

    assert points == []
