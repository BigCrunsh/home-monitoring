"""Base service implementation.

Provides shared initialization for settings, repository, and logger.
"""

from abc import ABC
from importlib import import_module
from typing import Optional

from home_monitoring.config import Settings, get_settings
from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.utils.logging import get_logger
from structlog.stdlib import BoundLogger


class BaseService(ABC):
    """Common base class for services.

    This class centralizes initialization of application settings,
    InfluxDB repository, and the structured logger.
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        repository: Optional[InfluxDBRepository] = None,
    ) -> None:
        """Initialize core service dependencies.

        Args:
            settings: Application settings. If not provided, loaded from env.
            repository: InfluxDB repository. If not provided, created with
                the effective settings.
        """
        self._settings: Settings = settings or get_settings()

        if repository is not None:
            self._db = repository
        else:
            # Resolve repository class from the concrete service module so
            # that tests can monkeypatch ``InfluxDBRepository`` there.
            module = import_module(self.__class__.__module__)
            repo_cls = getattr(module, "InfluxDBRepository", InfluxDBRepository)
            self._db = repo_cls(settings=self._settings)

        # Use the concrete service module name for log scoping
        self._logger: BoundLogger = get_logger(self.__class__.__module__)
