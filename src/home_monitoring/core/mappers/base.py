"""Base mapper interface."""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from home_monitoring.models.base import Measurement


class BaseMapper(ABC):
    """Base class for data mappers to InfluxDB measurements."""

    @staticmethod
    @abstractmethod
    def to_measurements(
        timestamp: datetime,
        *args: Any,
        **kwargs: Any,
    ) -> list[Measurement]:
        """Map data to InfluxDB measurements.

        Implementations typically follow the pattern::

            to_measurements(timestamp, data, *context)

        where ``data`` is the primary payload from an external API or
        device, and ``context`` contains optional parameters like
        ``site_id`` or other identifiers.

        Args:
            timestamp: Measurement timestamp
            *args: Mapper-specific positional arguments (data and context)
            **kwargs: Mapper-specific keyword arguments

        Returns:
            List of InfluxDB measurements
        """
        raise NotImplementedError
