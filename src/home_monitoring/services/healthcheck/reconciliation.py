"""Daily check of the grid meter's import against the utility meter.

The energy totals rest on the Shelly 3EM's lifetime import counter; the utility meter,
reported by Tibber, is what the bill is based on. Once a day, after Tibber has reported
yesterday, the two are compared, and a large difference (a slipped current clamp, a
reversed phase, a reset meter) is reported once. Missing figures are left to the
freshness checks.
"""

from datetime import datetime, timedelta
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

from home_monitoring.repositories.influxdb import InfluxDBRepository
from home_monitoring.services.healthcheck.notifier import TelegramNotifier

if TYPE_CHECKING:
    from home_monitoring.services.healthcheck.service import AlertStore

BERLIN = ZoneInfo("Europe/Berlin")
# Tibber's figure for yesterday is reliably in by then
CHECK_FROM_HOUR = 8
MIN_DIFFERENCE_KWH = 0.5
MIN_DIFFERENCE_SHARE = 0.05
# the counter reading taken for midnight must be at most this old
MIDNIGHT_TOLERANCE = timedelta(minutes=15)
IMPORT_COUNTER = '"iobroker"."global"."javascript.0.mqtt_shelly.import_total"'
STORE_KEY = "grid_reconciliation"


def _utc(moment: datetime) -> str:
    return moment.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")


def _kwh(value: float) -> str:
    return f"{value:.1f}".replace(".", ",") + " kWh"


class GridReconciliation:
    """Compares yesterday's grid import on the Shelly with the utility meter."""

    def __init__(
        self,
        db: InfluxDBRepository,
        store: "AlertStore",
        notifier: TelegramNotifier,
    ) -> None:
        self._db = db
        self._store = store
        self._notifier = notifier

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
        start = await self._counter_wh(at=yesterday)
        end = await self._counter_wh(at=today)
        if meter is None or start is None or end is None:
            return 0
        shelly = (end - start) / 1000
        difference = abs(shelly - meter)
        if (
            difference <= MIN_DIFFERENCE_KWH
            or difference <= MIN_DIFFERENCE_SHARE * meter
        ):
            return 0
        self._notifier.send(
            f"⚠️ Netzbezug gestern ({yesterday:%d.%m.}): Shelly {_kwh(shelly)}, "
            f"Stromzähler (Tibber) {_kwh(meter)}."
        )
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

    async def _counter_wh(self, at: datetime) -> float | None:
        query = (
            f"SELECT last(value) FROM {IMPORT_COUNTER}"
            f" WHERE time <= '{_utc(at)}' AND time > '{_utc(at - MIDNIGHT_TOLERANCE)}'"
        )
        return await self._first_value(query)

    async def _first_value(self, query: str) -> float | None:
        async for row in self._db.query(query):
            value = row.get("last")
            if isinstance(value, int | float):
                return float(value)
        return None
