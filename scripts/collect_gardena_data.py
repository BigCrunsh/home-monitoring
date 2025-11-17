#!/usr/bin/env python3
"""Script to collect data from Gardena smart system."""
import asyncio
import signal
import sys
from signal import Signals

from home_monitoring.services.gardena import GardenaService
from home_monitoring.utils.logging import configure_logging


async def main() -> int:
    """Run the Gardena data collection service.

    Returns:
        Exit code
    """
    configure_logging()
    service = GardenaService()

    # Set up signal handlers
    loop = asyncio.get_running_loop()

    def handle_signal(sig: signal.Signals) -> None:
        """Create a shutdown task for the given signal."""
        asyncio.create_task(shutdown(service, sig))

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))

    try:
        await service.start()
        # Keep the script running
        while True:
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


async def shutdown(service: GardenaService, signal: Signals) -> None:
    """Clean shutdown on receiving a signal.

    Args:
        service: Gardena service to shut down
        signal: Signal that triggered the shutdown
    """
    print(f"Received exit signal {signal.name}...")
    await service.stop()
    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    [task.cancel() for task in tasks]
    await asyncio.gather(*tasks, return_exceptions=True)
    loop = asyncio.get_running_loop()
    loop.stop()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
