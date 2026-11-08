"""Daily check of the stored grid import against the utility meter.

The 15-minute energy totals take the grid import from the Shelly 3EM; the utility
meter, reported by Tibber, is what the bill is based on. Once a day, after Tibber has
reported yesterday, yesterday's stored import is compared with the meter, and a large
difference (a slipped current clamp, a reversed phase, per-phase counting) is reported
once. Missing figures and incomplete days are left to the freshness checks.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from home_monitoring.repositories.influxdb import InfluxDBRepository

if TYPE_CHECKING:
    from home_monitoring.services.healthcheck.service import AlertStore

BERLIN = ZoneInfo("Europe/Berlin")
# Tibber's figure for yesterday is reliably in by then
CHECK_FROM_HOUR = 8
MIN_DIFFERENCE_KWH = 0.5
MIN_DIFFERENCE_SHARE = 0.05
INTERVAL = timedelta(minutes=15)
STORE_KEY = "grid_reconciliation"


def _utc(moment: datetime) -> str:
    return moment.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")


def _kwh(value: float) -> str:
    return f"{value:.1f}".replace(".", ",") + " kWh"


class GridReconciliation:
    """Compares yesterday's stored grid import with the utility meter."""

    def __init__(
        self,
        db: InfluxDBRepository,
        store: "AlertStore",
        send: Callable[[str], bool],
    ) -> None:
        self._db = db
        self._store = store
        self._send = send

    async def run(self, now: datetime) -> int:
        """Compare yesterday's figures, unless today's alert was already sent.

        Args:
            now: current time (UTC)

        Returns:
            Number of messages sent (0 or 1)
        """
        local = now.astimezone(BERLIN)
        if local.hour < CHECK_FROM_HOUR or self._alerted_today(local):
            return 0
        today = local.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)

        meter = await self._meter_kwh(since=today)
        shelly = await self._stored_import_kwh(yesterday, today)
        if meter is None or shelly is None:
            return 0
        difference = abs(shelly - meter)
        if (
            difference <= MIN_DIFFERENCE_KWH
            or difference <= MIN_DIFFERENCE_SHARE * meter
        ):
            return 0
        if not self._send(
            f"⚠️ Netzbezug gestern ({yesterday:%d.%m.}): Shelly {_kwh(shelly)}, "
            f"Stromzähler (Tibber) {_kwh(meter)}."
        ):
            return 0
        self._store.mark_alerted(STORE_KEY, now)
        return 1

    def _alerted_today(self, local: datetime) -> bool:
        last = self._store.last_alerted(STORE_KEY)
        return last is not None and last.astimezone(BERLIN).date() == local.date()

    async def _meter_kwh(self, since: datetime) -> float | None:
        query = (
            "SELECT last(consumption) FROM electricity_consumption_kwh"
            " WHERE period = 'last_day' AND source = 'grid'"
            f" AND time >= '{_utc(since)}'"
        )
        return await self._first_value(query)

    async def _stored_import_kwh(self, start: datetime, end: datetime) -> float | None:
        """Sum of the day's stored grid import, None unless every interval is there."""
        query = (
            "SELECT sum(Purchased), count(Purchased) FROM electricity_energy_watthour"
            f" WHERE time >= '{_utc(start)}' AND time < '{_utc(end)}'"
        )
        expected = (end.astimezone(UTC) - start.astimezone(UTC)) // INTERVAL
        async for row in self._db.query(query):
            if row.get("count") == expected and isinstance(row.get("sum"), int | float):
                return float(row["sum"]) / 1000
        return None

    async def _first_value(self, query: str) -> float | None:
        async for row in self._db.query(query):
            value = row.get("last")
            if isinstance(value, int | float):
                return float(value)
        return None
