#!/usr/bin/env python3
"""Script to collect data from Gardena smart system."""

import asyncio
import signal
import sys
from signal import Signals

from home_monitoring.services.gardena import GardenaService
from home_monitoring.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)

# re-write current device state this often (in-memory; no extra Gardena API calls).
# 60s resolves short cycle-and-soak valve pulses that 600s sampling misses.
REFRESH_INTERVAL_SECONDS = 60


async def main() -> int:
    """Run the Gardena data collection service.

    Returns:
        Exit code
    """
    configure_logging()
    service = GardenaService()

    # Set up signal handlers
    loop = asyncio.get_running_loop()

    tasks: list[asyncio.Task[None]] = []

    def handle_signal(sig: signal.Signals) -> None:
        """Create a shutdown task for the given signal."""
        task = asyncio.create_task(shutdown(service, sig))
        # Prevent the task from being garbage collected
        tasks.append(task)

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s))

    try:
        await service.start()
        # WebSocket callbacks write on change; this re-writes current state on a
        # fixed cadence so InfluxDB has a regular heartbeat regardless.
        while True:
            await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
            await service.refresh_all()
    except Exception as e:
        logger.error("gardena_collection_failed", error=str(e))
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
