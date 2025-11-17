"""Unit tests for SolarEdge mapper."""
from datetime import datetime, timezone

from home_monitoring.core.mappers.solaredge import SolarEdgeMapper


def test_to_measurements_success() -> None:
    """Test successful mapping of valid data."""
    # Arrange
    timestamp = datetime.now(timezone.utc)
    overview = {
        "overview": {
            "lastUpdateTime": "2024-02-16 20:00:00",
            "lifeTimeData": {"energy": 5000000.0},
            "lastYearData": {"energy": 1000000.0},
            "lastMonthData": {"energy": 300000.0},
            "lastDayData": {"energy": 10000.0},
            "currentPower": {"power": 1500.0},
        }
    }
    power_flow = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "connections": [],
            "grid": {"currentPower": 100.0},
            "load": {"currentPower": 1600.0},
            "pv": {"currentPower": 1500.0},
        }
    }

    # Act
    points = SolarEdgeMapper.to_measurements(timestamp, overview, power_flow)

    # Assert
    assert len(points) == 2

    # Check overview point
    overview_point = points[0]
    assert overview_point.measurement == "solaredge"
    assert overview_point.tags["type"] == "overview"
    assert overview_point.timestamp == timestamp
    assert overview_point.fields == {
        "lifetime_energy": 5000000.0,
        "last_year_energy": 1000000.0,
        "last_month_energy": 300000.0,
        "last_day_energy": 10000.0,
        "current_power": 1500.0,
    }

    # Check power flow point
    power_point = points[1]
    assert power_point.measurement == "solaredge"
    assert power_point.tags["type"] == "power_flow"
    assert power_point.tags["unit"] == "W"
    assert power_point.timestamp == timestamp
    assert power_point.fields == {
        "grid_power": 100.0,
        "load_power": 1600.0,
        "pv_power": 1500.0,
    }


def test_to_measurements_missing_overview() -> None:
    """Test handling of missing overview data."""
    # Arrange
    timestamp = datetime.now(timezone.utc)
    overview = {}
    power_flow = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "connections": [],
            "grid": {"currentPower": 100.0},
            "load": {"currentPower": 1600.0},
            "pv": {"currentPower": 1500.0},
        }
    }

    # Act
    points = SolarEdgeMapper.to_measurements(timestamp, overview, power_flow)

    # Assert
    assert len(points) == 1
    assert points[0].tags["type"] == "power_flow"


def test_to_measurements_missing_power_flow() -> None:
    """Test handling of missing power flow data."""
    # Arrange
    timestamp = datetime.now(timezone.utc)
    overview = {
        "overview": {
            "lastUpdateTime": "2024-02-16 20:00:00",
            "lifeTimeData": {"energy": 5000000.0},
            "lastYearData": {"energy": 1000000.0},
            "lastMonthData": {"energy": 300000.0},
            "lastDayData": {"energy": 10000.0},
            "currentPower": {"power": 1500.0},
        }
    }
    power_flow = {}

    # Act
    points = SolarEdgeMapper.to_measurements(timestamp, overview, power_flow)

    # Assert
    assert len(points) == 1
    assert points[0].tags["type"] == "overview"


def test_to_measurements_missing_fields() -> None:
    """Test handling of missing data fields."""
    # Arrange
    timestamp = datetime.now(timezone.utc)
    overview = {
        "overview": {
            "lastUpdateTime": "2024-02-16 20:00:00",
            # Missing some fields
            "lifeTimeData": {"energy": 5000000.0},
            "currentPower": {"power": 1500.0},
        }
    }
    power_flow = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "connections": [],
            # Missing some fields
            "grid": {"currentPower": 100.0},
        }
    }

    # Act
    points = SolarEdgeMapper.to_measurements(timestamp, overview, power_flow)

    # Assert
    assert len(points) == 2
    assert points[0].fields["lifetime_energy"] == 5000000.0
    assert points[0].fields["last_year_energy"] == 0.0
    assert points[1].fields["grid_power"] == 100.0
    assert points[1].fields["load_power"] == 0.0
