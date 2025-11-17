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

        Args:
            timestamp: Measurement timestamp
            *args: Additional positional arguments
            **kwargs: Additional keyword arguments

        Returns:
            List of InfluxDB measurements
        """
        raise NotImplementedError
