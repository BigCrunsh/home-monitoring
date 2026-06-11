"""Unit tests for the Tibber day-ahead price forecast collection."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.services.tibber.collection import (
    PRICE_FORECAST_MEASUREMENT,
    collect_price_forecast_data,
)


def make_home(price_total: object) -> MagicMock:
    home = MagicMock()
    home.update_info_and_price_info = AsyncMock()
    home.price_total = price_total
    return home


@pytest.mark.asyncio
async def test_forecast_collected_for_published_hours() -> None:
    """Published hourly prices become future-timestamped measurements (happy)."""
    home = make_home(
        {
            "2026-06-11T14:00:00+02:00": 0.31,
            "2026-06-11T15:00:00+02:00": 0.28,
        }
    )

    measurements = await collect_price_forecast_data(home)

    assert len(measurements) == 2
    assert all(m.measurement == PRICE_FORECAST_MEASUREMENT for m in measurements)
    assert measurements[0].fields["total"] == 0.31
    assert measurements[0].timestamp == datetime(2026, 6, 11, 12, 0, tzinfo=UTC)


@pytest.mark.asyncio
async def test_forecast_skips_unpublished_none_prices() -> None:
    """Hours Tibber lists without a price yet are skipped (unhappy path)."""
    home = make_home(
        {
            "2026-06-11T14:00:00+02:00": 0.31,
            "2026-06-12T14:00:00+02:00": None,
        }
    )

    measurements = await collect_price_forecast_data(home)

    assert len(measurements) == 1


@pytest.mark.asyncio
async def test_forecast_empty_when_no_data() -> None:
    """An empty forecast dict yields no measurements, no error (unhappy path)."""
    home = make_home({})

    assert await collect_price_forecast_data(home) == []


@pytest.mark.asyncio
async def test_forecast_survives_api_failure() -> None:
    """An API failure is logged and yields an empty list (unhappy path)."""
    home = make_home({})
    home.update_info_and_price_info = AsyncMock(side_effect=RuntimeError("api down"))

    assert await collect_price_forecast_data(home) == []
