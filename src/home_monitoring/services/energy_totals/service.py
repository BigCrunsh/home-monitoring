"""Write 15-minute energy computed from the meter counters ioBroker logs."""

from datetime import datetime, timedelta

from home_monitoring.config import Settings
from home_monitoring.repositories.influxdb import InfluxDBRepository, parse_influx_time
from home_monitoring.utils.logging import get_logger

from .intervals import MEASUREMENT, Reading, interval_energy, quarter_hours

# ioBroker state of each lifetime counter (Wh), keyed by the field it feeds
COUNTERS = {
    "Production": "javascript.0.solaredge_modbus_energy_total",
    "Purchased": "javascript.0.mqtt_shelly.import_total",
    "FeedIn": "javascript.0.mqtt_shelly.export_total",
}
MAXXISUN_POWER = "javascript.0.power_maxxisun"
# how far back a missed interval is recomputed after the collector was down
CATCH_UP = timedelta(days=7)
# an interval's start value may predate it this much (the Pi or a feed was down)
START_LOOKBACK = timedelta(hours=6)


class EnergyTotalsService:
    """Computes and stores the energy of every completed 15-minute interval."""

    def __init__(
        self,
        repository: InfluxDBRepository | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._db = repository or InfluxDBRepository()
        self._tags = {}
        site_id = (settings or Settings()).solaredge_site_id
        if site_id:
            self._tags["site_id"] = site_id
        self._logger = get_logger(__name__)

    async def collect(self, now: datetime) -> int:
        """Write the intervals completed since the last written one.

        Args:
            now: current time (UTC)

        Returns:
            Number of intervals written
        """
        latest = await self._db.get_latest_timestamp(MEASUREMENT)
        after = max(latest or now - CATCH_UP, now - CATCH_UP)
        starts = list(quarter_hours(after=after, now=now))
        if not starts:
            return 0

        since = starts[0] - START_LOOKBACK
        counters = {
            field: await self._readings(state, since)
            for field, state in COUNTERS.items()
        }
        maxxisun = await self._readings(MAXXISUN_POWER, since)

        points = []
        for start in starts:
            point = interval_energy(start, counters, maxxisun)
            if point is not None:
                points.append(point.model_copy(update={"tags": self._tags}))
        if points:
            await self._db.write_measurements(points)
        self._logger.info(
            "energy_totals_written", intervals=len(starts), written=len(points)
        )
        return len(points)

    async def _readings(self, state: str, since: datetime) -> list[Reading]:
        query = (
            f'SELECT value FROM "iobroker"."global"."{state}"'
            f" WHERE time >= '{since:%Y-%m-%dT%H:%M:%SZ}' ORDER BY time ASC"
        )
        readings = []
        async for row in self._db.query(query):
            time = parse_influx_time(row.get("time"))
            value = row.get("value")
            if time is not None and isinstance(value, int | float):
                readings.append(Reading(time, float(value)))
        return readings
