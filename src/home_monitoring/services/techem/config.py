"""Techem service configuration."""

from dataclasses import dataclass


@dataclass
class SerialConfig:
    """Serial port configuration."""

    port: str = "/dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0"
    baudrate: int = 38400
    timeout: int = 300
