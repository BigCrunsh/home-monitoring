"""Dynu DNS service implementation."""
import httpx
from structlog.stdlib import BoundLogger

from home_monitoring.config import Settings, get_settings
from home_monitoring.utils.logging import get_logger


class DynuService:
    """Service for updating Dynu DNS entries."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the service.

        Args:
            settings: Application settings. If not provided, will be loaded from environment.
        """
        self._settings = settings or get_settings()
        self._logger: BoundLogger = get_logger(__name__)

    async def update_dns(self) -> None:
        """Update DNS entry at Dynu.com."""
        self._logger.info("updating_dns_entry", host=self._settings.dynu_host)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://api.dynu.com/nic/update",
                params={
                    "host": self._settings.dynu_host,
                    "username": self._settings.dynu_username,
                    "password": self._settings.dynu_password,
                },
            )
            response.raise_for_status()

            self._logger.info(
                "dns_update_response",
                status=response.status_code,
                text=response.text,
            )
