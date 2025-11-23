"""Integration tests for SolarEdge service."""

import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.solaredge.service import SolarEdgeService

EXPECTED_PRODUCTION = 2953.0
EXPECTED_CONSUMPTION = 29885.0


@pytest.mark.asyncio
async def test_solaredge_data_collection_and_storage() -> None:
    """Integration test to verify SolarEdge detailed data collection and storage."""
    # Mock API responses for detailed energy and power data
    mock_energy_details_response = {
        "energyDetails": {
            "timeUnit": "WEEK",
            "unit": "Wh",
            "meters": [
                {
                    "type": "Production",
                    "values": [
                        {
                            "date": "2015-11-16 00:00:00",
                            "value": EXPECTED_PRODUCTION,
                        },
                    ],
                },
                {
                    "type": "Consumption",
                    "values": [
                        {
                            "date": "2015-11-16 00:00:00",
                            "value": EXPECTED_CONSUMPTION,
                        },
                    ],
                },
            ],
        }
    }

    mock_power_details_response = {
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
            ],
        }
    }

    # Mock settings with test credentials
    settings = Settings(
        solaredge_api_key="test_api_key",
        solaredge_site_id="123456",
        influxdb_host="localhost",
        influxdb_port=8086,
        influxdb_database="test_db",
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
    with (
        patch.object(
            service, "_get_energy_details", return_value=mock_energy_details_response
        ),
        patch.object(
            service, "_get_power_details", return_value=mock_power_details_response
        ),
    ):

        print("=== STARTING SOLAREDGE DETAILED DATA COLLECTION ===")
        start_time = datetime(2015, 11, 16, 0, 0, 0, tzinfo=UTC)
        end_time = datetime(2015, 11, 23, 0, 0, 0, tzinfo=UTC)

        # Collect energy and power details
        await service.collect_and_store_energy_details(
            start_time,
            end_time,
            time_unit="WEEK",
            meters=["PRODUCTION", "CONSUMPTION"],
        )

        power_start = datetime(2015, 11, 21, 11, 0, 0, tzinfo=UTC)
        power_end = datetime(2015, 11, 21, 11, 30, 0, tzinfo=UTC)
        await service.collect_and_store_power_details(
            power_start,
            power_end,
            meters=["PRODUCTION", "CONSUMPTION"],
        )

        # Verify measurements were stored
        assert len(stored_measurements) > 0, "No measurements were stored!"

        print("=== VERIFICATION RESULTS ===")
        print(f"Total measurements stored: {len(stored_measurements)}")

        # Check for expected measurement types
        measurement_names = [m.measurement for m in stored_measurements]

        print(f"Measurement names: {measurement_names}")

        assert (
            "electricity_energy_watthour" in measurement_names
        ), "Expected 'electricity_energy_watthour' measurement"
        assert (
            "electricity_power_watt" in measurement_names
        ), "Expected 'electricity_power_watt' measurement"

        # Check energy measurement fields
        energy_measurement = next(
            m
            for m in stored_measurements
            if m.measurement == "electricity_energy_watthour"
        )
        print("=== ENERGY MEASUREMENT FIELDS ===")
        for field, value in energy_measurement.fields.items():
            print(f"  {field}: {value}")

        assert energy_measurement.fields["Production"] == EXPECTED_PRODUCTION
        assert energy_measurement.fields["Consumption"] == EXPECTED_CONSUMPTION

        # Check power measurements
        power_measurements = [
            m for m in stored_measurements if m.measurement == "electricity_power_watt"
        ]
        print("=== POWER MEASUREMENTS ===")
        print(f"Count: {len(power_measurements)}")

        first_power = power_measurements[0]
        print("=== FIRST POWER MEASUREMENT FIELDS ===")
        for field, value in first_power.fields.items():
            print(f"  {field}: {value}")

        assert "Consumption" in first_power.fields
        assert "Purchased" in first_power.fields

        print("=== ALL VERIFICATIONS PASSED ===")


@pytest.mark.asyncio
async def test_solaredge_missing_credentials() -> None:
    """Test that service fails gracefully with missing credentials."""
    settings = Settings()  # No credentials set

    with pytest.raises(ValueError, match="Missing SolarEdge credentials"):
        SolarEdgeService(settings=settings)


@pytest.mark.asyncio
async def test_solaredge_api_error_handling() -> None:
    """Test that API errors are handled and logged properly for energy details."""
    settings = Settings(solaredge_api_key="test_api_key", solaredge_site_id="123456")

    mock_influxdb = AsyncMock(spec=InfluxDBRepository)

    # Mock HTTP client to raise an error
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get.side_effect = Exception(
            "API Error"
        )

        service = SolarEdgeService(settings=settings)
        service._db = mock_influxdb

        # Should raise an APIError when collecting energy details
        with pytest.raises(APIError):
            await service.collect_and_store_energy_details(
                datetime(2015, 11, 16, 0, 0, 0, tzinfo=UTC),
                datetime(2015, 11, 23, 0, 0, 0, tzinfo=UTC),
                time_unit="WEEK",
            )

        # Should not have stored any measurements
        mock_influxdb.write_measurements.assert_not_called()


if __name__ == "__main__":
    # Run the integration test directly
    asyncio.run(test_solaredge_data_collection_and_storage())
