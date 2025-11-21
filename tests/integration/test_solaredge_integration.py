"""Integration tests for SolarEdge service."""

import asyncio
from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.solaredge.service import SolarEdgeService


@pytest.mark.asyncio
async def test_solaredge_data_collection_and_storage():
    """Integration test to verify SolarEdge data collection and storage."""
    # Mock API responses with realistic SolarEdge data
    mock_overview_response = {
        "overview": {
            "lifeTimeData": {"energy": 12345678.0},
            "lastYearData": {"energy": 8765.4},
            "lastMonthData": {"energy": 543.2},
            "lastDayData": {"energy": 25.6},
            "currentPower": {"power": 3500.0}
        }
    }
    
    mock_power_flow_response = {
        "siteCurrentPowerFlow": {
            "unit": "W",
            "pv": {"currentPower": 4200.0},
            "load": {"currentPower": 2800.0},
            "grid": {"currentPower": -1400.0}  # Negative = feeding back to grid
        }
    }

    # Mock settings with test credentials
    settings = Settings(
        solaredge_api_key="test_api_key",
        solaredge_site_id="123456",
        influxdb_host="localhost",
        influxdb_port=8086,
        influxdb_database="test_db"
    )

    # Mock InfluxDB repository to capture what gets stored
    mock_influxdb = AsyncMock(spec=InfluxDBRepository)
    stored_measurements = []
    
    async def capture_measurements(measurements):
        stored_measurements.extend(measurements)
        print(f"\n=== CAPTURED {len(measurements)} MEASUREMENTS ===")
        for i, measurement in enumerate(measurements):
            print(f"Measurement {i+1}:")
            print(f"  Name: {measurement.measurement}")
            print(f"  Tags: {measurement.tags}")
            print(f"  Fields: {measurement.fields}")
            print(f"  Timestamp: {measurement.timestamp}")
            print()
    
    mock_influxdb.write_measurements.side_effect = capture_measurements

    # Create service and mock its internal methods directly
    service = SolarEdgeService(settings=settings)
    service._db = mock_influxdb
    
    # Mock the internal API methods directly
    with patch.object(service, '_get_overview', return_value=mock_overview_response) as mock_overview, \
         patch.object(service, '_get_power_flow', return_value=mock_power_flow_response) as mock_power_flow:
        
        print("=== STARTING SOLAREDGE DATA COLLECTION ===")
        await service.collect_and_store()
        
        # Verify measurements were stored
        assert len(stored_measurements) > 0, "No measurements were stored!"
        
        print(f"=== VERIFICATION RESULTS ===")
        print(f"Total measurements stored: {len(stored_measurements)}")
        
        # Check for expected measurement types
        measurement_names = [m.measurement for m in stored_measurements]
        measurement_types = [m.tags.get("type") for m in stored_measurements]
        
        print(f"Measurement names: {measurement_names}")
        print(f"Measurement types: {measurement_types}")
        
        # Verify we have both overview and power_flow measurements
        assert "solaredge" in measurement_names, f"Expected 'solaredge' measurement, got: {measurement_names}"
        assert "electricity_power_watt" in measurement_names, f"Expected 'electricity_power_watt' measurement, got: {measurement_names}"
        assert "overview" in measurement_types, f"Expected 'overview' type, got: {measurement_types}"
        assert "power_flow" in measurement_types, f"Expected 'power_flow' type, got: {measurement_types}"
        
        # Check specific fields
        overview_measurement = next(m for m in stored_measurements if m.tags.get("type") == "overview")
        power_flow_measurement = next(m for m in stored_measurements if m.tags.get("type") == "power_flow")
        
        print(f"=== OVERVIEW MEASUREMENT FIELDS ===")
        for field, value in overview_measurement.fields.items():
            print(f"  {field}: {value}")
            
        print(f"=== POWER FLOW MEASUREMENT FIELDS ===")
        for field, value in power_flow_measurement.fields.items():
            print(f"  {field}: {value}")
        
        # Verify expected fields exist
        assert "current_power" in overview_measurement.fields
        assert "pv_power" in power_flow_measurement.fields
        assert "grid_power" in power_flow_measurement.fields
        assert "load_power" in power_flow_measurement.fields
        
        # Verify field values
        assert overview_measurement.fields["current_power"] == 3500.0
        assert power_flow_measurement.fields["pv_power"] == 4200.0
        assert power_flow_measurement.fields["grid_power"] == -1400.0
        assert power_flow_measurement.fields["load_power"] == 2800.0
        
        # Check electricity_power_watt measurements
        power_measurements = [m for m in stored_measurements if m.measurement == "electricity_power_watt"]
        print(f"=== ELECTRICITY POWER WATT MEASUREMENTS ===")
        print(f"Count: {len(power_measurements)}")
        
        sources = [m.tags.get("source") for m in power_measurements]
        print(f"Sources: {sources}")
        
        # Should have measurements for grid, pv, and load
        assert "grid" in sources, f"Expected 'grid' source, got: {sources}"
        assert "pv" in sources, f"Expected 'pv' source, got: {sources}"
        assert "load" in sources, f"Expected 'load' source, got: {sources}"
        
        # Verify power values
        grid_measurement = next(m for m in power_measurements if m.tags.get("source") == "grid")
        pv_measurement = next(m for m in power_measurements if m.tags.get("source") == "pv")
        load_measurement = next(m for m in power_measurements if m.tags.get("source") == "load")
        
        assert grid_measurement.fields["power"] == -1400.0
        assert pv_measurement.fields["power"] == 4200.0
        assert load_measurement.fields["power"] == 2800.0
        
        print(f"  Grid power: {grid_measurement.fields['power']} W")
        print(f"  PV power: {pv_measurement.fields['power']} W")
        print(f"  Load power: {load_measurement.fields['power']} W")
        
        print("=== ALL VERIFICATIONS PASSED ===")


@pytest.mark.asyncio
async def test_solaredge_missing_credentials():
    """Test that service fails gracefully with missing credentials."""
    settings = Settings()  # No credentials set
    
    with pytest.raises(ValueError, match="Missing SolarEdge credentials"):
        SolarEdgeService(settings=settings)


@pytest.mark.asyncio 
async def test_solaredge_api_error_handling():
    """Test that API errors are handled and logged properly."""
    settings = Settings(
        solaredge_api_key="test_api_key",
        solaredge_site_id="123456"
    )
    
    mock_influxdb = AsyncMock(spec=InfluxDBRepository)
    
    # Mock HTTP client to raise an error
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get.side_effect = Exception("API Error")
        
        service = SolarEdgeService(settings=settings)
        service._db = mock_influxdb
        
        # Should raise an exception
        with pytest.raises(Exception):
            await service.collect_and_store()
        
        # Should not have stored any measurements
        mock_influxdb.write_measurements.assert_not_called()


if __name__ == "__main__":
    # Run the integration test directly
    asyncio.run(test_solaredge_data_collection_and_storage())
