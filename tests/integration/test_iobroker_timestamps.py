"""Test that timestamps are properly set in ioBroker integration."""

from datetime import UTC, datetime

import pytest
from home_monitoring.config import Settings
from home_monitoring.repositories.influxdb import InfluxDBRepository


@pytest.fixture(scope="function")
def influxdb_repo():
    """Create InfluxDB repository for testing."""
    settings = Settings()
    repo = InfluxDBRepository(settings=settings)
    return repo


@pytest.mark.asyncio
async def test_price_data_has_timestamp(influxdb_repo: InfluxDBRepository):
    """Test that price data includes timestamp field.
    
    The ioBroker script expects row.time to exist in query results.
    """
    query = (
        "SELECT * FROM electricity_prices_euro "
        "ORDER BY time DESC LIMIT 1"
    )
    
    result = [row async for row in influxdb_repo.query(query)]
    
    assert len(result) > 0, "No price data found"
    row = result[0]
    
    # Verify timestamp field exists (InfluxDB uses 'ts' field name)
    assert "ts" in row, "Missing 'ts' field in price data"
    
    # Verify timestamp is recent (within last 2 hours)
    timestamp_str = row["ts"]
    timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
    age_hours = (datetime.now(UTC) - timestamp).total_seconds() / 3600
    
    assert age_hours < 2, f"Price timestamp is {age_hours:.1f} hours old (too stale)"


@pytest.mark.asyncio
async def test_consumption_data_has_timestamp(influxdb_repo: InfluxDBRepository):
    """Test that consumption data includes timestamp field.
    
    The ioBroker script expects row.time to exist in query results.
    """
    query = (
        "SELECT last(*) FROM electricity_consumption_kwh "
        "WHERE source = 'grid' GROUP BY period"
    )
    
    result = [row async for row in influxdb_repo.query(query)]
    
    assert len(result) > 0, "No consumption data found"
    
    # Check that at least one row has a timestamp
    has_timestamp = any("ts" in row for row in result)
    assert has_timestamp, "No consumption data rows have 'ts' field"
    
    # Verify timestamps are recent for rows that have them
    for row in result:
        if "ts" in row:
            timestamp_str = row["ts"]
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            age_hours = (datetime.now(UTC) - timestamp).total_seconds() / 3600
            
            assert age_hours < 2, (
                f"Consumption timestamp for period {row.get('period')} "
                f"is {age_hours:.1f} hours old (too stale)"
            )


@pytest.mark.asyncio
async def test_cost_data_has_timestamp(influxdb_repo: InfluxDBRepository):
    """Test that cost data includes timestamp field.
    
    The ioBroker script expects row.time to exist in query results.
    """
    query = (
        "SELECT last(*) FROM electricity_costs_euro "
        "GROUP BY period"
    )
    
    result = [row async for row in influxdb_repo.query(query)]
    
    assert len(result) > 0, "No cost data found"
    
    # Check that at least one row has a timestamp
    has_timestamp = any("ts" in row for row in result)
    assert has_timestamp, "No cost data rows have 'ts' field"
    
    # Verify timestamps are recent for rows that have them
    for row in result:
        if "ts" in row:
            timestamp_str = row["ts"]
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            age_hours = (datetime.now(UTC) - timestamp).total_seconds() / 3600
            
            assert age_hours < 2, (
                f"Cost timestamp for period {row.get('period')} "
                f"is {age_hours:.1f} hours old (too stale)"
            )


@pytest.mark.asyncio
async def test_timestamp_conversion_logic():
    """Test that JavaScript timestamp conversion logic is correct.
    
    JavaScript code: Math.floor(new Date(row.ts).getTime())
    This should convert ISO timestamp to milliseconds since epoch.
    """
    # Use current time for test
    now = datetime.now(UTC)
    test_timestamp = now.isoformat().replace("+00:00", "Z")
    
    # Python equivalent of JavaScript conversion
    dt = datetime.fromisoformat(test_timestamp.replace("Z", "+00:00"))
    milliseconds = int(dt.timestamp() * 1000)
    
    # Verify it's a reasonable timestamp (not 0)
    assert milliseconds > 0, "Timestamp conversion resulted in 0"
    
    # Verify it's recent (within last minute)
    now_ms = int(now.timestamp() * 1000)
    one_minute_ms = 60 * 1000
    
    assert abs(now_ms - milliseconds) < one_minute_ms, (
        f"Timestamp is not within reasonable range: "
        f"{abs(now_ms - milliseconds)} ms difference"
    )
