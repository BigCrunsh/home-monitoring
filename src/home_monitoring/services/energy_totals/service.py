"""Write 15-minute energy from the inverter counter and the grid meter's records."""

from datetime import datetime, timedelta

import httpx
from home_monitoring.config import Settings
from home_monitoring.repositories.influxdb import InfluxDBRepository, parse_influx_time
from home_monitoring.utils.logging import get_logger

from .intervals import (
    INTERVAL,
    MEASUREMENT,
    Reading,
    interval_energy,
    quarter_hours,
)
from .shelly import grid_net_energy

# the inverter's lifetime AC energy counter (Wh), logged by ioBroker
PRODUCTION_COUNTER = "javascript.0.solaredge_modbus_energy_total"
MAXXISUN_POWER = "javascript.0.power_maxxisun"
# how far back a missed interval is recomputed after the collector was down
CATCH_UP = timedelta(days=7)
# an interval's start value may predate it this much (the Pi or a feed was down)
START_LOOKBACK = timedelta(hours=6)


class EnergyTotalsService:
    """Computes and stores the energy of every completed 15-minute interval."""

    def __init__(
        self,
        http: httpx.AsyncClient,
        repository: InfluxDBRepository | None = None,
        settings: Settings | None = None,
    ) -> None:
        settings = settings or Settings()
        self._db = repository or InfluxDBRepository()
        self._http = http
        self._shelly = settings.shelly_3em_host
        self._tags = {}
        if settings.solaredge_site_id:
            self._tags["site_id"] = settings.solaredge_site_id
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
        production = await self._readings(PRODUCTION_COUNTER, since)
        maxxisun = await self._readings(MAXXISUN_POWER, since)
        grid = await grid_net_energy(
            self._http, self._shelly, starts[0], starts[-1] + INTERVAL
        )

        points = []
        for start in starts:
            point = interval_energy(start, production, grid.get(start), maxxisun)
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
