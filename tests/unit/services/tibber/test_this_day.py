"""Unit tests for today's running Tibber totals (period this_day).

Tibber reports completed hours only. In the first hour after midnight no hour of the
new day is complete; nothing was written then, so the dashboard kept showing
yesterday's total as "today" until about 01:00.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from zoneinfo import ZoneInfo

import pytest
from home_monitoring.services.tibber.aggregation import aggregate_this_day_data

BERLIN = ZoneInfo("Europe/Berlin")
STAMP = datetime(2026, 11, 8, 0, 20, tzinfo=BERLIN)


def home(hours: list[dict[str, float]]) -> MagicMock:
    h = MagicMock()
    h.get_historic_data = AsyncMock(return_value=hours)
    return h


def fields(measurements, measurement):  # type: ignore[no-untyped-def]
    return [
        (m.tags.get("source"), m.fields)
        for m in measurements
        if m.measurement == measurement
    ]


@pytest.mark.asyncio(scope="function")
async def test_completed_hours_are_summed() -> None:
    """At 03:20 the hours 0-2 make up today so far."""
    hours = [{"totalCost": 0.1, "consumption": 0.2}] * 3
    measurements, cost, consumption, _ = await aggregate_this_day_data(
        home(hours), MagicMock(time_zone=BERLIN), STAMP, now=STAMP.replace(hour=3)
    )
    assert cost == pytest.approx(0.3)
    assert consumption == pytest.approx(0.6)
    assert fields(measurements, "electricity_costs_euro") == [
        (None, {"cost": pytest.approx(0.3)})
    ]


@pytest.mark.asyncio(scope="function")
async def test_in_the_first_hour_today_is_zero_not_yesterday() -> None:
    """00:20: no hour is complete yet, so today so far is 0, written as such."""
    tibber = home([])
    measurements, cost, consumption, _ = await aggregate_this_day_data(
        tibber, MagicMock(time_zone=BERLIN), STAMP, now=STAMP
    )
    assert cost == 0.0
    assert consumption == 0.0
    assert fields(measurements, "electricity_costs_euro") == [(None, {"cost": 0.0})]
    assert (None, {"consumption": 0.0}) in fields(
        measurements, "electricity_consumption_kwh"
    )
    assert ("grid", {"consumption": 0.0}) in fields(
        measurements, "electricity_consumption_kwh"
    )
    tibber.get_historic_data.assert_not_awaited()


@pytest.mark.asyncio(scope="function")
async def test_an_hour_with_missing_figures_writes_nothing() -> None:
    """Incomplete data is not passed off as a total."""
    hours = [{"totalCost": 0.1, "consumption": None}]
    measurements, cost, _, _ = await aggregate_this_day_data(
        home(hours), MagicMock(time_zone=BERLIN), STAMP, now=STAMP.replace(hour=1)
    )
    assert measurements == []
    assert cost is None
