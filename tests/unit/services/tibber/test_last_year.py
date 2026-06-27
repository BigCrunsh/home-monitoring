"""Unit tests for the Tibber last-completed-year collection.

Regression coverage for the bug where ``cost_last_year`` /
``consumption_grid_last_year`` stayed at 0: Tibber's ANNUAL history returns
only *completed* calendar years, so a home with a single completed year gets
exactly one node. The old code required ``len(...) > 1`` and read index ``[1]``,
silently skipping the only year that exists.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.services.tibber.collection import collect_last_year_data

TS = datetime(2026, 6, 27, 12, 0, tzinfo=UTC)

# Shape of a real ANNUAL consumption node (see probe against the live API):
# both ``cost`` (energy, ex-tax) and ``totalCost`` are present; ``this_year``
# is built from MONTHLY ``cost`` fields, so ``last_year`` must use ``cost`` too.
YEAR_2025 = {
    "from": "2025-01-01T00:00:00.000+01:00",
    "unitPrice": 0.341746,
    "totalCost": 671.544632632048,
    "cost": 558.240106562145,
    "consumption": 1633.4959,
}
YEAR_2024 = {
    "from": "2024-01-01T00:00:00.000+01:00",
    "totalCost": 800.0,
    "cost": 700.0,
    "consumption": 2000.0,
}


def make_home(annual: object, production: object = None) -> MagicMock:
    home = MagicMock()
    home.get_historic_data = AsyncMock(side_effect=[annual, production or []])
    return home


def by_measurement(measurements: list, name: str) -> list:
    return [m for m in measurements if m.measurement == name]


@pytest.mark.asyncio
async def test_single_completed_year_is_collected() -> None:
    """Happy path: one completed year (the common case) is recorded."""
    home = make_home([YEAR_2025])

    measurements = await collect_last_year_data(home, TS)

    costs = by_measurement(measurements, "electricity_costs_euro")
    assert len(costs) == 1
    assert costs[0].tags == {"period": "last_year"}
    # Must use ``cost`` (558.24), not ``totalCost`` (671.54), to stay
    # apples-to-apples with this_year (which sums monthly ``cost``).
    assert costs[0].fields["cost"] == pytest.approx(558.240106562145)


@pytest.mark.asyncio
async def test_single_completed_year_grid_consumption() -> None:
    """With no solar, grid consumption equals total consumption."""
    home = make_home([YEAR_2025])

    measurements = await collect_last_year_data(home, TS)

    grid = [
        m
        for m in by_measurement(measurements, "electricity_consumption_kwh")
        if m.tags.get("source") == "grid"
    ]
    assert len(grid) == 1
    assert grid[0].tags == {"period": "last_year", "source": "grid"}
    assert grid[0].fields["consumption"] == pytest.approx(1633.4959)


@pytest.mark.asyncio
async def test_uses_most_recent_completed_year() -> None:
    """When two years come back, the latest (last element) is last_year."""
    home = make_home([YEAR_2024, YEAR_2025])

    measurements = await collect_last_year_data(home, TS)

    costs = by_measurement(measurements, "electricity_costs_euro")
    assert costs[0].fields["cost"] == pytest.approx(558.240106562145)


@pytest.mark.asyncio
async def test_empty_history_yields_nothing() -> None:
    """Unhappy path: no completed years yet → no measurements, no error."""
    home = make_home([])

    assert await collect_last_year_data(home, TS) == []


@pytest.mark.asyncio
async def test_missing_cost_is_skipped() -> None:
    """Unhappy path: a node without cost/consumption is skipped."""
    home = make_home([{"from": "2025-01-01T00:00:00+01:00", "cost": None}])

    assert await collect_last_year_data(home, TS) == []


@pytest.mark.asyncio
async def test_api_error_is_swallowed() -> None:
    """Unhappy path: an API exception yields an empty list, not a crash."""
    home = MagicMock()
    home.get_historic_data = AsyncMock(side_effect=RuntimeError("boom"))

    assert await collect_last_year_data(home, TS) == []


@pytest.mark.asyncio
async def test_production_split_off_grid_and_solar() -> None:
    """When solar production exists, it is split from grid consumption."""
    home = make_home(
        [{"from": "2025-01-01T00:00:00+01:00", "cost": 500.0, "consumption": 1600.0}],
        production=[{"from": "2025-01-01T00:00:00+01:00", "production": 600.0}],
    )

    measurements = await collect_last_year_data(home, TS)

    grid = [
        m
        for m in by_measurement(measurements, "electricity_consumption_kwh")
        if m.tags.get("source") == "grid"
    ]
    solar = [
        m
        for m in by_measurement(measurements, "electricity_consumption_kwh")
        if m.tags.get("source") == "solar"
    ]
    assert grid[0].fields["consumption"] == pytest.approx(1000.0)
    assert solar[0].fields["consumption"] == pytest.approx(600.0)
