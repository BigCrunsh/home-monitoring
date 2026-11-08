"""15-minute energy from the inverter counter, the grid meter and the Maxxisun plug.

Production is the difference of the inverter's lifetime AC energy counter (Modbus, Wh,
logged by ioBroker about once a minute) between the last readings before the interval's
two ends, so it stays exact across gaps. The grid exchange is the Shelly 3EM's energy
for the interval netted across the three phases, as the utility meter bills it. The
Maxxisun has no usable counter, so its share is its signed power held between readings
(negative = feeding the house, positive = charging).
"""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from home_monitoring.models.base import Measurement

INTERVAL = timedelta(minutes=15)
# the last reading must be this recent at an interval's end, else the feed was down
MAX_READING_AGE = timedelta(minutes=5)
# readings of an interval's last minute need a moment to reach InfluxDB
SETTLE = timedelta(minutes=2)
MEASUREMENT = "electricity_energy_watthour"
WH_PER_WATT_SECOND = 1 / 3600


@dataclass(frozen=True)
class Reading:
    """One logged value of a counter (Wh) or of a power (W)."""

    time: datetime
    value: float


def quarter_hours(after: datetime, now: datetime) -> Iterator[datetime]:
    """Yield the starts of the completed intervals after the one starting at after."""
    epoch = datetime(1970, 1, 1, tzinfo=UTC)
    start = epoch + (after - epoch) // INTERVAL * INTERVAL + INTERVAL
    while start + INTERVAL + SETTLE < now:
        yield start
        start += INTERVAL


def last_before(readings: list[Reading], moment: datetime) -> Reading | None:
    """Return the newest reading at or before moment (readings are sorted by time)."""
    found = None
    for reading in readings:
        if reading.time > moment:
            break
        found = reading
    return found


def held_energy(
    power: list[Reading], start: datetime, end: datetime
) -> tuple[float, float]:
    """Return (fed, charged) Wh of a signed power held from each reading to the next."""
    fed = charged = 0.0
    current = last_before(power, start)
    level = current.value if current else 0.0
    since = start
    for reading in power:
        if reading.time <= start:
            continue
        if reading.time >= end:
            break
        fed, charged = _add(fed, charged, level, reading.time - since)
        level, since = reading.value, reading.time
    return _add(fed, charged, level, end - since)


def _add(
    fed: float, charged: float, watts: float, span: timedelta
) -> tuple[float, float]:
    wh = abs(watts) * span.total_seconds() * WH_PER_WATT_SECOND
    return (fed + wh, charged) if watts < 0 else (fed, charged + wh)


def interval_energy(
    start: datetime,
    production: list[Reading],
    grid_net: float | None,
    maxxisun: list[Reading],
) -> Measurement | None:
    """Return the energy of the interval starting at start, None if it is not known.

    Args:
        start: interval start (UTC)
        production: readings of the inverter's lifetime energy counter (Wh)
        grid_net: the grid meter's net energy for the interval (Wh, + import, - export)
        maxxisun: readings of the Maxxisun's signed power

    Returns:
        The interval's measurement, or None when the grid figure is missing, or the
        production counter has no reading before the start, a stale reading at the
        end, or went backwards
    """
    end = start + INTERVAL
    first, last = last_before(production, start), last_before(production, end)
    if grid_net is None or first is None or last is None:
        return None
    if end - last.time > MAX_READING_AGE or last.value < first.value:
        return None

    produced = last.value - first.value
    purchased, feed_in = max(0.0, grid_net), max(0.0, -grid_net)
    fed, charged = held_energy(maxxisun, start, end)
    generation = produced + fed
    fields = {
        "Production": produced,
        "Purchased": purchased,
        "FeedIn": feed_in,
        "Maxxisun": fed - charged,
        "SelfConsumption": max(0.0, generation - feed_in),
        "Consumption": max(0.0, purchased + generation - feed_in - charged),
    }
    return Measurement(timestamp=start, measurement=MEASUREMENT, tags={}, fields=fields)
