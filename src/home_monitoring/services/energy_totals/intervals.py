"""15-minute energy from lifetime meter counters.

The counters are the inverter's AC energy (Modbus), and the grid meter's import and
export (Shelly 3EM), all in Wh and logged by ioBroker about once a minute. Energy in an
interval is the difference of the last readings before its two ends, so it stays exact
across gaps. The Maxxisun has no usable counter, so its share is its signed power held
between readings (negative = feeding the house, positive = charging).
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
    start: datetime, counters: dict[str, list[Reading]], maxxisun: list[Reading]
) -> Measurement | None:
    """Return the energy of the interval starting at start, None if it is not known.

    Args:
        start: interval start (UTC)
        counters: readings of the "Production", "Purchased" and "FeedIn" counters
        maxxisun: readings of the Maxxisun's signed power

    Returns:
        The interval's measurement, or None when a counter has no reading before the
        start, its reading at the end is stale, or it went backwards
    """
    end = start + INTERVAL
    energy = {}
    for name, readings in counters.items():
        first, last = last_before(readings, start), last_before(readings, end)
        if first is None or last is None or end - last.time > MAX_READING_AGE:
            return None
        if last.value < first.value:
            return None
        energy[name] = last.value - first.value

    fed, charged = held_energy(maxxisun, start, end)
    generation = energy["Production"] + fed
    fields = {
        "Production": energy["Production"],
        "Purchased": energy["Purchased"],
        "FeedIn": energy["FeedIn"],
        "Maxxisun": fed - charged,
        "SelfConsumption": max(0.0, generation - energy["FeedIn"]),
        "Consumption": max(
            0.0, energy["Purchased"] + generation - energy["FeedIn"] - charged
        ),
    }
    return Measurement(timestamp=start, measurement=MEASUREMENT, tags={}, fields=fields)
