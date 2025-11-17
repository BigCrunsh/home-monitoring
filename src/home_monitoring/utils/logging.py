"""Logging configuration for the application."""
import logging
import sys
from typing import Any

import structlog
from structlog.types import Processor

from home_monitoring.config import get_settings


def configure_logging() -> None:
    """Configure structured logging."""
    processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]

    settings = get_settings()
    if settings.json_logs:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(get_settings().log_level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(*args: Any) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(*args)
