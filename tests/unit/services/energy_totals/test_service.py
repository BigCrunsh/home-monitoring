"""Unit tests for the service writing 15-minute energy.

Production comes from the inverter counter ioBroker logs; the grid exchange from the
Shelly's phase-netted records, asked for over HTTP.
"""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from home_monitoring.config import Settings
from home_monitoring.models.base import Measurement
from home_monitoring.services.energy_totals.service import EnergyTotalsService

NOW = datetime(2026, 11, 6, 10, 48, tzinfo=UTC)
LAST_WRITTEN = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
INVERTER = "javascript.0.solaredge_modbus_energy_total"


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


def shelly(per_period: list[list[float]] | None) -> httpx.AsyncClient:
    """A Shelly with phase records from 10:15 (None = unreachable)."""

    def handler(request: httpx.Request) -> httpx.Response:
        if per_period is None:
            return httpx.Response(503)
        ts = int(datetime(2026, 11, 6, 10, 15, tzinfo=UTC).timestamp())
        return httpx.Response(
            200, json={"data": [{"ts": ts, "period": 900, "values": per_period}]}
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def service(repo: FakeRepository, http: httpx.AsyncClient) -> EnergyTotalsService:
    return EnergyTotalsService(
        repository=repo, settings=Settings(solaredge_site_id="1264339"), http=http
    )


@pytest.mark.asyncio(scope="function")
async def test_completed_intervals_are_written_with_the_site_tag() -> None:
    """10:15 and 10:30 have ended; each gets production and its netted grid energy."""
    repo = FakeRepository(LAST_WRITTEN, {INVERTER: minute_readings(15_000_000, 20)})
    phases = [[-200.0, 10.0, 300.0], [-500.0, 0.0, 100.0]]
    written = await service(repo, shelly(phases)).collect(now=NOW)
    assert written == 2
    assert [p.timestamp.minute for p in repo.written] == [15, 30]
    assert repo.written[0].tags == {"site_id": "1264339"}
    assert repo.written[0].fields["Production"] == 300.0
    assert repo.written[0].fields["Purchased"] == 110.0
    assert repo.written[1].fields["FeedIn"] == 400.0


@pytest.mark.asyncio(scope="function")
async def test_nothing_is_read_or_written_when_no_interval_has_completed() -> None:
    """The last written interval is the newest completed one."""
    repo = FakeRepository(datetime(2026, 11, 6, 10, 30, tzinfo=UTC), {})
    assert await service(repo, shelly(None)).collect(now=NOW) == 0
    assert repo.queries == []
    assert repo.written == []


@pytest.mark.asyncio(scope="function")
async def test_an_interval_the_shelly_has_no_record_for_is_skipped() -> None:
    """Only 10:15 has a grid record; 10:30 stays unwritten rather than guessed."""
    repo = FakeRepository(LAST_WRITTEN, {INVERTER: minute_readings(15_000_000, 20)})
    written = await service(repo, shelly([[1.0, 2.0, 3.0]])).collect(now=NOW)
    assert written == 1
    assert repo.written[0].timestamp.minute == 15


@pytest.mark.asyncio(scope="function")
async def test_an_unreachable_shelly_fails_the_run_and_writes_nothing() -> None:
    """The next cron run retries; the Shelly keeps its records meanwhile."""
    repo = FakeRepository(LAST_WRITTEN, {INVERTER: minute_readings(15_000_000, 20)})
    with pytest.raises(httpx.HTTPStatusError):
        await service(repo, shelly(None)).collect(now=NOW)
    assert repo.written == []


@pytest.mark.asyncio(scope="function")
async def test_production_is_read_from_the_iobroker_database() -> None:
    """ioBroker logs into its own database and retention policy, not home_monitoring."""
    repo = FakeRepository(LAST_WRITTEN, {})
    await service(repo, shelly([[1.0, 2.0, 3.0]])).collect(now=NOW)
    assert any(f'"iobroker"."global"."{INVERTER}"' in q for q in repo.queries)
