"""Example script to retrieve Tibber energy costs and consumption.

This script demonstrates how to use the TibberService to retrieve
energy cost and consumption data for the last hour and yesterday.
"""

import asyncio

from home_monitoring.services.tibber.service import TibberService


async def main() -> None:
    """Retrieve and display Tibber energy costs and consumption."""
    # Initialize service (uses settings from environment variables)
    service = TibberService()

    try:
        # Get data for the last complete hour
        last_hour_cost = await service.get_last_hour_cost()
        last_hour_consumption = await service.get_last_hour_consumption()
        print(f"Last hour: {last_hour_consumption:.2f} kWh → {last_hour_cost:.2f} EUR")

        # Get data for yesterday
        yesterday_cost = await service.get_yesterday_cost()
        yesterday_consumption = await service.get_yesterday_consumption()
        print(
            f"Yesterday: {yesterday_consumption:.2f} kWh → {yesterday_cost:.2f} EUR"
        )

        # Get data for the last 24 hours
        last_24h_cost = await service.get_last_24h_cost()
        last_24h_consumption = await service.get_last_24h_consumption()
        print(
            f"Last 24h: {last_24h_consumption:.2f} kWh → {last_24h_cost:.2f} EUR"
        )

        # Calculate average prices per kWh
        if yesterday_consumption > 0:
            avg_price_yesterday = yesterday_cost / yesterday_consumption
            print(f"Average price yesterday: {avg_price_yesterday:.3f} EUR/kWh")

        if last_24h_consumption > 0:
            avg_price_24h = last_24h_cost / last_24h_consumption
            print(f"Average price last 24h: {avg_price_24h:.3f} EUR/kWh")

    except ValueError as e:
        print(f"Error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
