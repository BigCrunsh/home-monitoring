"""Unit tests for the one-off Tibber monthly history backfill.

InfluxDB only held monthly cost/consumption from Nov 2025 on, so the Energie tab
could not compare a month with the same month a year earlier. Each completed month
is written the way the live collector writes last_month, but at 00:00 UTC on the
first day of the following month — the window the dashboard reads it from.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from home_monitoring.services.tibber.collection import collect_monthly_history

NOW = datetime(2026, 10, 31, 8, 0, tzinfo=UTC)
OCT_2025 = {
    "from": "2025-10-01T00:00:00.000+02:00",
    "cost": 70.12,
    "totalCost": 84.0,
    "consumption": 180.5,
}
DEC_2025 = {
    "from": "2025-12-01T00:00:00.000+01:00",
    "cost": 85.0,
    "totalCost": 103.0,
    "consumption": 270.5,
}


def make_home(monthly: object, production: object = None) -> MagicMock:
    home = MagicMock()
    home.get_historic_data = AsyncMock(side_effect=[monthly, production or []])
    return home


def of(measurements: list, name: str, source: str | None = None) -> list:
    return [
        m
        for m in measurements
        if m.measurement == name and m.tags.get("source") == source
    ]


@pytest.mark.asyncio
async def test_each_month_is_stored_at_the_start_of_the_following_month() -> None:
    home = make_home([OCT_2025, DEC_2025])

    measurements = await collect_monthly_history(home, months=24, now=NOW)

    costs = of(measurements, "electricity_costs_euro")
    assert [(c.timestamp, c.fields["cost"]) for c in costs] == [
        (datetime(2025, 11, 1, tzinfo=UTC), pytest.approx(70.12)),
        (datetime(2026, 1, 1, tzinfo=UTC), pytest.approx(85.0)),
    ]
    assert all(c.tags == {"period": "last_month"} for c in costs)
    assert [
        c.fields["consumption"] for c in of(measurements, "electricity_consumption_kwh")
    ] == [
        pytest.approx(180.5),
        pytest.approx(270.5),
    ]


@pytest.mark.asyncio
async def test_solar_production_is_split_off_that_months_grid_consumption() -> None:
    home = make_home(
        [OCT_2025], production=[{"from": OCT_2025["from"], "production": 30.5}]
    )

    measurements = await collect_monthly_history(home, months=24, now=NOW)

    assert of(measurements, "electricity_consumption_kwh", "grid")[0].fields[
        "consumption"
    ] == pytest.approx(150.0)
    assert of(measurements, "electricity_consumption_kwh", "solar")[0].fields[
        "consumption"
    ] == pytest.approx(30.5)


@pytest.mark.asyncio
async def test_a_month_without_ex_tax_cost_is_skipped_not_filled_gross() -> None:
    home = make_home([{**OCT_2025, "cost": None}, DEC_2025])

    measurements = await collect_monthly_history(home, months=24, now=NOW)

    assert [c.fields["cost"] for c in of(measurements, "electricity_costs_euro")] == [
        pytest.approx(85.0)
    ]


@pytest.mark.asyncio
async def test_the_running_month_is_never_written_as_completed() -> None:
    running = {
        "from": "2026-10-01T00:00:00.000+02:00",
        "cost": 40.0,
        "consumption": 120.0,
    }
    home = make_home([DEC_2025, running])

    measurements = await collect_monthly_history(home, months=24, now=NOW)

    assert len(of(measurements, "electricity_costs_euro")) == 1


@pytest.mark.asyncio
async def test_an_api_error_yields_nothing_rather_than_a_partial_history() -> None:
    home = MagicMock()
    home.get_historic_data = AsyncMock(side_effect=RuntimeError("boom"))

    assert await collect_monthly_history(home, months=24, now=NOW) == []


@pytest.mark.asyncio
async def test_a_node_with_an_unreadable_month_is_skipped() -> None:
    home = make_home([{**OCT_2025, "from": "garbage"}, DEC_2025])

    measurements = await collect_monthly_history(home, months=24, now=NOW)

    assert len(of(measurements, "electricity_costs_euro")) == 1
