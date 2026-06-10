"""Telegram notification delivery for the freshness healthcheck.

Messages are sent through the ioBroker telegram adapter via the ``iobroker
message`` CLI, so the bot token stays inside ioBroker and delivery reaches all
chats known to the adapter. Trade-off: alerting depends on ioBroker running on
the same host (acceptable — if ioBroker is down, the dashboard is visibly dead).
"""

import json
import subprocess

from home_monitoring.core.exceptions import APIError
from home_monitoring.utils.logging import get_logger

# iobroker message blocks until the adapter acknowledges; bound it
SEND_TIMEOUT_SECONDS = 30


class TelegramNotifier:
    """Send alert messages via the ioBroker telegram adapter."""

    def __init__(self, instance: str = "telegram.0") -> None:
        """Initialize the notifier.

        Args:
            instance: ioBroker telegram adapter instance to send through
        """
        self._instance = instance
        self._logger = get_logger(__name__)

    def send(self, text: str) -> None:
        """Send a message to all chats known to the telegram adapter.

        Args:
            text: Message text

        Raises:
            APIError: If the message could not be handed to the adapter
        """
        try:
            result = subprocess.run(
                [
                    "iobroker",
                    "message",
                    self._instance,
                    "send",
                    json.dumps({"text": text}),
                ],
                capture_output=True,
                text=True,
                timeout=SEND_TIMEOUT_SECONDS,
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as e:
            self._logger.error("telegram_send_failed", error=str(e))
            raise APIError("Failed to send telegram notification") from e

        if result.returncode != 0:
            self._logger.error(
                "telegram_send_failed",
                returncode=result.returncode,
                stderr=result.stderr.strip(),
            )
            raise APIError("Failed to send telegram notification")

        self._logger.info("telegram_notification_sent", text=text)
