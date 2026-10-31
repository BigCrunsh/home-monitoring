"""Unit tests for the Tibber last-completed-month collection.

Regression coverage for the month cost being stored as ``totalCost`` (incl. taxes)
while this_month and this_year sum ``cost`` (ex-tax): the Energie tab compared a
net month forecast with a gross previous month, ~20 % apart.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.services.tibber.collection import collect_last_month_data

TS = datetime(2026, 10, 1, 0, 5, tzinfo=UTC)

# Shape of a real MONTHLY consumption node: both ``cost`` and ``totalCost`` present.
SEPTEMBER = {
    "from": "2026-09-01T00:00:00.000+02:00",
    "to": "2026-10-01T00:00:00.000+02:00",
    "totalCost": 29.97,
    "cost": 24.98,
    "consumption": 47.24,
}


def make_home(monthly: object, production: object = None) -> MagicMock:
    home = MagicMock()
    home.get_historic_data = AsyncMock(side_effect=[monthly, production or []])
    return home


def costs_of(measurements: list) -> list:
    return [m for m in measurements if m.measurement == "electricity_costs_euro"]


@pytest.mark.asyncio
async def test_month_cost_is_the_ex_tax_cost_like_this_month() -> None:
    home = make_home([SEPTEMBER])

    measurements = await collect_last_month_data(home, TS)

    costs = costs_of(measurements)
    assert len(costs) == 1
    assert costs[0].tags == {"period": "last_month"}
    assert costs[0].fields["cost"] == pytest.approx(24.98)


@pytest.mark.asyncio
async def test_month_with_only_total_cost_is_skipped_rather_than_mixed() -> None:
    home = make_home([{**SEPTEMBER, "cost": None}])

    assert costs_of(await collect_last_month_data(home, TS)) == []


@pytest.mark.asyncio
async def test_empty_month_history_yields_nothing() -> None:
    home = make_home([])

    assert await collect_last_month_data(home, TS) == []
