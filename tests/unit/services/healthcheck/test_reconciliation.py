"""Unit tests for the daily grid-import reconciliation against the utility meter.

The stored 15-minute energy totals take the grid import from the Shelly 3EM; the
utility meter (reported by Tibber) is what the bill is based on. A large daily
difference means the totals are wrong (a slipped current clamp, a reversed phase, or
counting per phase: on 2026-11-07 the Shelly's per-phase counters said 10.8 kWh, the
meter 6.6), worth one message.
"""

import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from home_monitoring.services.healthcheck import AlertStore
from home_monitoring.services.healthcheck.reconciliation import GridReconciliation

# 09:00 in Berlin on 2026-11-08; yesterday is 2026-11-07, midnight Berlin = 23:00 UTC
NOW = datetime(2026, 11, 8, 8, 0, tzinfo=UTC)
FULL_DAY = 96


class FakeDB:
    """Answers the utility-meter query and the stored-totals query by their text."""

    def __init__(
        self, meter_kwh: float | None, purchased_wh: float, intervals: int = FULL_DAY
    ) -> None:
        self.meter_kwh = meter_kwh
        self.purchased_wh = purchased_wh
        self.intervals = intervals
        self.queries: list[str] = []

    async def query(self, query: str) -> AsyncIterator[dict[str, Any]]:
        self.queries.append(query)
        if "electricity_consumption_kwh" in query:
            if self.meter_kwh is not None:
                yield {"time": "2026-11-07T23:00:00Z", "last": self.meter_kwh}
        elif "electricity_energy_watthour" in query:
            assert "time >= '2026-11-06T23:00:00Z'" in query
            assert "time < '2026-11-07T23:00:00Z'" in query
            if self.intervals:
                yield {"sum": self.purchased_wh, "count": self.intervals}


class FakeNotifier:
    def __init__(self) -> None:
        self.sent: list[str] = []

    def send(self, text: str) -> bool:
        self.sent.append(text)
        return True


def run_check(tmp_path: Path, db: FakeDB, now: datetime = NOW) -> list[str]:
    notifier = FakeNotifier()
    store = AlertStore(tmp_path / "state.json")
    check = GridReconciliation(db=db, store=store, send=notifier.send)  # type: ignore[arg-type]
    asyncio.run(check.run(now))
    store.save()
    return notifier.sent


def test_meters_that_agree_send_nothing(tmp_path: Path) -> None:
    """8.1 kWh vs. 8.3 kWh is within 5 %."""
    assert run_check(tmp_path, FakeDB(meter_kwh=8.3, purchased_wh=8100.0)) == []


def test_a_large_discrepancy_names_both_figures(tmp_path: Path) -> None:
    """8.1 kWh in the stored totals vs. 9.4 kWh on the utility meter."""
    assert run_check(tmp_path, FakeDB(meter_kwh=9.4, purchased_wh=8100.0)) == [
        "⚠️ Netzbezug gestern (07.11.): Shelly 8,1 kWh, Stromzähler (Tibber) 9,4 kWh."
    ]


def test_a_discrepancy_is_sent_once_per_day(tmp_path: Path) -> None:
    """The hourly healthcheck must not repeat the same day's message."""
    db = FakeDB(meter_kwh=9.4, purchased_wh=8100.0)
    first = run_check(tmp_path, db)
    second = run_check(tmp_path, db, now=NOW.replace(hour=12))
    assert len(first) == 1
    assert second == []


def test_a_small_absolute_difference_is_not_reported(tmp_path: Path) -> None:
    """On a 2 kWh day, 0.3 kWh is 15 % but below the 0.5 kWh floor."""
    assert run_check(tmp_path, FakeDB(meter_kwh=2.3, purchased_wh=2000.0)) == []


def test_no_message_without_the_utility_meter_figure(tmp_path: Path) -> None:
    """Missing data is the freshness check's job, not a discrepancy."""
    assert run_check(tmp_path, FakeDB(meter_kwh=None, purchased_wh=8100.0)) == []


def test_no_message_when_yesterday_has_gaps_in_the_totals(tmp_path: Path) -> None:
    """A day with missing intervals would compare a partial sum with the whole day."""
    db = FakeDB(meter_kwh=9.4, purchased_wh=4000.0, intervals=60)
    assert run_check(tmp_path, db) == []


def test_no_message_without_any_totals_for_yesterday(tmp_path: Path) -> None:
    """No stored intervals at all: nothing to compare."""
    assert (
        run_check(tmp_path, FakeDB(meter_kwh=9.4, purchased_wh=0.0, intervals=0)) == []
    )


def test_nothing_is_checked_before_tibber_has_reported_yesterday(
    tmp_path: Path,
) -> None:
    """Before 08:00 Berlin the utility meter's figure for yesterday may be missing."""
    db = FakeDB(meter_kwh=9.4, purchased_wh=8100.0)
    assert run_check(tmp_path, db, now=NOW.replace(hour=5)) == []
    assert db.queries == []
