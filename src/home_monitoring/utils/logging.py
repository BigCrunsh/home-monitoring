"""Logging configuration for the application."""

import logging
from typing import Any

import structlog
from home_monitoring.config import get_settings
from structlog.types import Processor


def configure_logging(verbose: bool = False) -> None:
    """Configure structured logging.

    Args:
        verbose: If True, sets log level to DEBUG
    """
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

    log_level = "DEBUG" if verbose else settings.log_level
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(log_level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(*args: Any) -> structlog.BoundLogger:
    """Get a structured logger instance."""
    return structlog.get_logger(*args)
