#!/usr/bin/env python3
"""Debug script to test SolarEdge data collection with detailed logging."""

import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Add src to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent / "src"))

from home_monitoring.config import Settings
from home_monitoring.services.solaredge.service import SolarEdgeService
from home_monitoring.utils.logging import configure_logging


async def main():
    """Test SolarEdge data collection with detailed logging."""
    # Configure logging to see debug messages
    configure_logging()
    
    # Check if credentials are available
    api_key = os.getenv("SOLAREDGE_API_KEY")
    site_id = os.getenv("SOLAREDGE_SITE_ID")
    
    if not api_key or not site_id:
        print("❌ Missing SolarEdge credentials!")
        print("Please set environment variables:")
        print("  export SOLAREDGE_API_KEY='your_api_key'")
        print("  export SOLAREDGE_SITE_ID='your_site_id'")
        return 1
    
    print("🔧 Testing SolarEdge data collection...")
    print(f"   Site ID: {site_id}")
    print(f"   API Key: {api_key[:8]}...")
    
    now = datetime.now(UTC)
    
    try:
        # Create service with debug logging
        settings = Settings(
            solaredge_api_key=api_key,
            solaredge_site_id=site_id,
            log_level="DEBUG"  # Enable debug logging
        )
        
        service = SolarEdgeService(settings=settings)
        
        print("\n🚀 Starting detailed energy collection (energyDetails)...")
        energy_start = now - timedelta(days=30)
        await service.collect_and_store_energy_details(
            start_time=energy_start,
            end_time=now,
            time_unit="WEEK",
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )

        print("\n🚀 Starting detailed power collection (powerDetails)...")
        power_start = now - timedelta(hours=1)
        await service.collect_and_store_power_details(
            start_time=power_start,
            end_time=now,
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )
        
        print("\n✅ Data collection completed successfully!")
        print("\n📊 Expected measurements in InfluxDB:")
        print("   - 'electricity_energy_watthour' with fields:")
        print("     * Production, Consumption, FeedIn, Purchased, SelfConsumption")
        print("   - 'electricity_power_watt' with fields:")
        print("     * Production, Consumption, FeedIn, Purchased, SelfConsumption")
        print("\n💡 Example InfluxDB queries:")
        print(
            "   SELECT SUM(Consumption) FROM electricity_energy_watthour "
            "WHERE time >= now() - 30d GROUP BY time(1w)"
        )
        print(
            "   SELECT LAST(Production) FROM electricity_power_watt "
            "WHERE time >= now() - 1h"
        )
        
        return 0
        
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
    except Exception as e:
        print(f"❌ Data collection failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
