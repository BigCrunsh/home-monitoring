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
            APIError: If the message could not be handed to the adapter, or if
                the adapter has no registered chat users (the message would be
                silently delivered to nobody — this exact mode went unnoticed
                for 3 years with the washing-machine notifications)
        """
        self._ensure_registered_users()
        result = self._run_iobroker(
            ["message", self._instance, "send", json.dumps({"text": text})]
        )
        if result.returncode != 0:
            self._logger.error(
                "telegram_send_failed",
                returncode=result.returncode,
                stderr=result.stderr.strip(),
            )
            raise APIError("Failed to send telegram notification")

        self._logger.info("telegram_notification_sent", text=text)

    def _ensure_registered_users(self) -> None:
        """Fail loudly when the adapter knows no chats to deliver to."""
        result = self._run_iobroker(
            ["state", "get", f"{self._instance}.communicate.users"]
        )
        try:
            users = json.loads(json.loads(result.stdout)["val"])
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            self._logger.error("telegram_users_unreadable", error=str(e))
            raise APIError("Cannot read telegram registered users") from e

        if not users:
            self._logger.error("telegram_no_registered_users")
            raise APIError(
                "Telegram adapter has no registered chat users; "
                "send /password <pw> to the bot to register"
            )

    def _run_iobroker(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        """Run an iobroker CLI command with a bounded timeout."""
        try:
            return subprocess.run(
                ["iobroker", *args],
                capture_output=True,
                text=True,
                timeout=SEND_TIMEOUT_SECONDS,
                check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as e:
            self._logger.error("telegram_send_failed", error=str(e))
            raise APIError("Failed to send telegram notification") from e
