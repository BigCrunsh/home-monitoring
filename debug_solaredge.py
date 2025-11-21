#!/usr/bin/env python3
"""Debug script to test SolarEdge data collection with detailed logging."""

import asyncio
import os
import sys
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
    
    print(f"🔧 Testing SolarEdge data collection...")
    print(f"   Site ID: {site_id}")
    print(f"   API Key: {api_key[:8]}...")
    
    try:
        # Create service with debug logging
        settings = Settings(
            solaredge_api_key=api_key,
            solaredge_site_id=site_id,
            log_level="DEBUG"  # Enable debug logging
        )
        
        service = SolarEdgeService(settings=settings)
        
        print("\n🚀 Starting data collection...")
        await service.collect_and_store()
        
        print("\n✅ Data collection completed successfully!")
        print("\n📊 Expected measurements in InfluxDB:")
        print("   - Measurement name: 'solaredge'")
        print("   - Overview type with fields:")
        print("     * lifetime_energy, last_year_energy, last_month_energy")
        print("     * last_day_energy, current_power")
        print("   - Power flow type with fields:")
        print("     * grid_power, load_power, pv_power")
        print("\n💡 To query in InfluxDB:")
        print("   SELECT * FROM solaredge WHERE type='power_flow' ORDER BY time DESC LIMIT 10")
        print("   SELECT current_power FROM solaredge WHERE type='overview' ORDER BY time DESC LIMIT 10")
        
        return 0
        
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        return 1
    except Exception as e:
        print(f"❌ Data collection failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
