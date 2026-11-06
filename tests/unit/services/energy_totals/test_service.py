"""Unit tests for the service writing 15-minute energy from ioBroker's counter logs."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from home_monitoring.config import Settings
from home_monitoring.models.base import Measurement
from home_monitoring.services.energy_totals.service import EnergyTotalsService

NOW = datetime(2026, 11, 6, 10, 48, tzinfo=UTC)
LAST_WRITTEN = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
INVERTER = "javascript.0.solaredge_modbus_energy_total"
IMPORT = "javascript.0.mqtt_shelly.import_total"
EXPORT = "javascript.0.mqtt_shelly.export_total"


def minute_readings(first: float, per_minute: float) -> list[tuple[str, float]]:
    """A counter logged every minute from 10:00 to 10:47."""
    start = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
    return [
        (
            (start + timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            first + m * per_minute,
        )
        for m in range(48)
    ]


class FakeRepository:
    """Serves logged readings per ioBroker state and records what is written."""

    def __init__(
        self, latest: datetime | None, logs: dict[str, list[tuple[str, float]]]
    ):
        self.latest = latest
        self.logs = logs
        self.queries: list[str] = []
        self.written: list[Measurement] = []

    async def get_latest_timestamp(self, measurement: str) -> datetime | None:
        return self.latest

    async def query(self, query: str) -> AsyncIterator[dict[str, Any]]:
        self.queries.append(query)
        for state, rows in self.logs.items():
            if f'"{state}"' in query:
                for time, value in rows:
                    yield {"time": time, "value": value}

    async def write_measurements(self, measurements: list[Measurement]) -> None:
        self.written.extend(measurements)


def service(repo: FakeRepository) -> EnergyTotalsService:
    return EnergyTotalsService(
        repository=repo, settings=Settings(solaredge_site_id="1264339")
    )


@pytest.mark.asyncio(scope="function")
async def test_completed_intervals_are_written_with_the_site_tag() -> None:
    """10:15 and 10:30 have ended; each gets its counter differences."""
    repo = FakeRepository(
        LAST_WRITTEN,
        {
            INVERTER: minute_readings(15_000_000, 20),
            IMPORT: minute_readings(3_900_000, 2),
            EXPORT: minute_readings(6_000_000, 10),
        },
    )
    written = await service(repo).collect(now=NOW)
    assert written == 2
    assert [p.timestamp.minute for p in repo.written] == [15, 30]
    assert repo.written[0].tags == {"site_id": "1264339"}
    assert repo.written[0].fields["Production"] == 300.0
    assert repo.written[0].fields["Purchased"] == 30.0
    assert repo.written[0].fields["FeedIn"] == 150.0


@pytest.mark.asyncio(scope="function")
async def test_nothing_is_read_or_written_when_no_interval_has_completed() -> None:
    """The last written interval is the newest completed one."""
    repo = FakeRepository(datetime(2026, 11, 6, 10, 30, tzinfo=UTC), {})
    assert await service(repo).collect(now=NOW) == 0
    assert repo.queries == []
    assert repo.written == []


@pytest.mark.asyncio(scope="function")
async def test_no_counter_logs_writes_nothing() -> None:
    """Before the counters were logged, the intervals are unknown and skipped."""
    repo = FakeRepository(LAST_WRITTEN, {})
    assert await service(repo).collect(now=NOW) == 0
    assert repo.written == []


@pytest.mark.asyncio(scope="function")
async def test_counters_are_read_from_the_iobroker_database() -> None:
    """ioBroker logs into its own database and retention policy, not home_monitoring."""
    repo = FakeRepository(LAST_WRITTEN, {})
    await service(repo).collect(now=NOW)
    assert any(f'"iobroker"."global"."{INVERTER}"' in q for q in repo.queries)
