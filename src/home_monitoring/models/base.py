"""Base models for the application."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class TimestampedModel(BaseModel):
    """Base model with timestamp."""

    timestamp: datetime

    model_config = ConfigDict(
        frozen=True,
        json_encoders={datetime: lambda v: v.isoformat()},
    )


class Measurement(TimestampedModel):
    """Base measurement model."""

    measurement: str
    tags: dict[str, str]
    fields: dict[str, Any]
