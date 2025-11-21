"""Custom exceptions for the application."""

from enum import Enum
from typing import Any

from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Error codes for the application."""

    DATABASE_ERROR = "database_error"
    API_ERROR = "api_error"
    VALIDATION_ERROR = "validation_error"
    CONFIGURATION_ERROR = "configuration_error"
    AUTHENTICATION_ERROR = "authentication_error"


class ErrorDetail(BaseModel):
    """Error detail model."""

    code: ErrorCode
    message: str
    details: dict[str, Any] | None = None


class HomeMonitoringError(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        code: ErrorCode,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error.

        Args:
            message: Error message
            code: Error code
            details: Additional error details
        """
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details

    def to_detail(self) -> ErrorDetail:
        """Convert the error to an ErrorDetail model."""
        return ErrorDetail(
            code=self.code,
            message=self.message,
            details=self.details,
        )


class DatabaseError(HomeMonitoringError):
    """Raised when a database operation fails."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error."""
        super().__init__(message, ErrorCode.DATABASE_ERROR, details)


class APIError(HomeMonitoringError):
    """Raised when an external API call fails."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error."""
        super().__init__(message, ErrorCode.API_ERROR, details)


class ValidationError(HomeMonitoringError):
    """Raised when data validation fails."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error."""
        super().__init__(message, ErrorCode.VALIDATION_ERROR, details)


class ConfigurationError(HomeMonitoringError):
    """Raised when configuration is invalid."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error."""
        super().__init__(message, ErrorCode.CONFIGURATION_ERROR, details)


class AuthenticationError(HomeMonitoringError):
    """Raised when authentication fails."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Initialize the error."""
        super().__init__(message, ErrorCode.AUTHENTICATION_ERROR, details)
