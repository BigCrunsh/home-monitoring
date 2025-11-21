#!/usr/bin/env python3
"""Collect data from Techem meters."""
import argparse
import asyncio
import sys

from home_monitoring.services.techem import TechemService
from home_monitoring.services.techem.config import SerialConfig
from home_monitoring.utils.logging import configure_logging


async def main(args: argparse.Namespace) -> int:
    """Run the data collection.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    configure_logging()

    # Create serial configuration from command line arguments
    serial_config = SerialConfig(
        port=args.serial_port,
        baudrate=args.serial_baudrate,
        timeout=args.serial_timeout,
    )

    service = TechemService(serial_config=serial_config)

    try:
        await service.collect_and_store(num_packets=args.serial_num_packets)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Collect data from Techem meters via serial port",
    )
    parser.add_argument(
        "--serial-port",
        default="/dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0",
        help="Serial port to listen on",
    )
    parser.add_argument(
        "--serial-baudrate",
        type=int,
        default=38400,
        help="Serial port baudrate",
    )
    parser.add_argument(
        "--serial-num-packets",
        type=int,
        default=5,
        help="Number of packets to collect",
    )
    parser.add_argument(
        "--serial-timeout",
        type=int,
        default=300,
        help="Serial port timeout in seconds",
    )
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
