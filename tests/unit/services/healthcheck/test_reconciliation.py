"""Unit tests for the daily grid-import reconciliation against the utility meter.

The Shelly 3EM's import counter drives the energy totals; the utility meter (reported
by Tibber) is what the bill is based on. A large daily difference means a slipped
current clamp, a reversed phase or a reset meter, worth one message.
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


class FakeDB:
    """Answers the meter query and the two counter queries by their text."""

    def __init__(
        self,
        meter_kwh: float | None,
        counter_wh: dict[str, float | None],
    ) -> None:
        self.meter_kwh = meter_kwh
        self.counter_wh = counter_wh
        self.queries: list[str] = []

    async def query(self, query: str) -> AsyncIterator[dict[str, Any]]:
        self.queries.append(query)
        if "electricity_consumption_kwh" in query:
            if self.meter_kwh is not None:
                yield {"time": "2026-11-07T23:00:00Z", "last": self.meter_kwh}
            return
        for bound, value in self.counter_wh.items():
            if f"time <= '{bound}'" in query and value is not None:
                yield {"time": bound, "last": value}


class FakeNotifier:
    def __init__(self) -> None:
        self.sent: list[str] = []

    def send(self, text: str) -> None:
        self.sent.append(text)


def counters(day_start: float | None, day_end: float | None) -> dict[str, float | None]:
    return {"2026-11-06T23:00:00Z": day_start, "2026-11-07T23:00:00Z": day_end}


def run_check(tmp_path: Path, db: FakeDB, now: datetime = NOW) -> list[str]:
    notifier = FakeNotifier()
    store = AlertStore(tmp_path / "state.json")
    check = GridReconciliation(db=db, store=store, notifier=notifier)  # type: ignore[arg-type]
    asyncio.run(check.run(now))
    store.save()
    return notifier.sent


def test_meters_that_agree_send_nothing(tmp_path: Path) -> None:
    """8.1 kWh vs. 8.3 kWh is within 5 %."""
    db = FakeDB(meter_kwh=8.3, counter_wh=counters(3_900_000.0, 3_908_100.0))
    assert run_check(tmp_path, db) == []


def test_a_large_discrepancy_names_both_figures(tmp_path: Path) -> None:
    """8.1 kWh on the Shelly vs. 9.4 kWh on the utility meter."""
    db = FakeDB(meter_kwh=9.4, counter_wh=counters(3_900_000.0, 3_908_100.0))
    assert run_check(tmp_path, db) == [
        "⚠️ Netzbezug gestern (07.11.): Shelly 8,1 kWh, Stromzähler (Tibber) 9,4 kWh."
    ]


def test_a_discrepancy_is_sent_once_per_day(tmp_path: Path) -> None:
    """The hourly healthcheck must not repeat the same day's message."""
    db = FakeDB(meter_kwh=9.4, counter_wh=counters(3_900_000.0, 3_908_100.0))
    first = run_check(tmp_path, db)
    second = run_check(tmp_path, db, now=NOW.replace(hour=12))
    assert len(first) == 1
    assert second == []


def test_a_small_absolute_difference_is_not_reported(tmp_path: Path) -> None:
    """On a 2 kWh day, 0.3 kWh is 15 % but below the 0.5 kWh floor."""
    db = FakeDB(meter_kwh=2.3, counter_wh=counters(3_900_000.0, 3_902_000.0))
    assert run_check(tmp_path, db) == []


def test_no_message_without_the_utility_meter_figure(tmp_path: Path) -> None:
    """Missing data is the freshness check's job, not a discrepancy."""
    db = FakeDB(meter_kwh=None, counter_wh=counters(3_900_000.0, 3_908_100.0))
    assert run_check(tmp_path, db) == []


def test_no_message_without_a_counter_reading_at_midnight(tmp_path: Path) -> None:
    """Without both midnight readings yesterday's import is unknown."""
    db = FakeDB(meter_kwh=9.4, counter_wh=counters(None, 3_908_100.0))
    assert run_check(tmp_path, db) == []


def test_nothing_is_checked_before_tibber_has_reported_yesterday(
    tmp_path: Path,
) -> None:
    """Before 08:00 Berlin the utility meter's figure for yesterday may be missing."""
    db = FakeDB(meter_kwh=9.4, counter_wh=counters(3_900_000.0, 3_908_100.0))
    assert run_check(tmp_path, db, now=NOW.replace(hour=5)) == []
    assert db.queries == []
