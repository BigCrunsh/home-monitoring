"""Unit tests for 15-minute energy from meter counters.

The SolarEdge cloud that delivered these totals was retired on 2026-11-03. They now come
from lifetime counters (inverter AC energy, grid-meter import and export, in Wh) logged
about once a minute, plus the Maxxisun's signed power (negative = feeding the house).
"""

from datetime import UTC, datetime, timedelta

from home_monitoring.services.energy_totals import (
    Reading,
    interval_energy,
    quarter_hours,
)

T0 = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
MIN = timedelta(minutes=1)


def counters(
    start: dict[str, float], end: dict[str, float]
) -> dict[str, list[Reading]]:
    """Readings one minute before the interval start and one minute before its end."""
    return {
        name: [Reading(T0 - MIN, start[name]), Reading(T0 + 14 * MIN, end[name])]
        for name in start
    }


def test_interval_energy_is_the_counter_difference() -> None:
    """Production, purchase and feed-in are what the counters advanced by."""
    readings = counters(
        {"Production": 1000.0, "Purchased": 500.0, "FeedIn": 200.0},
        {"Production": 1400.0, "Purchased": 550.0, "FeedIn": 300.0},
    )
    point = interval_energy(T0, readings, maxxisun=[])
    assert point is not None
    assert point.timestamp == T0
    assert point.measurement == "electricity_energy_watthour"
    assert point.fields == {
        "Production": 400.0,
        "Purchased": 50.0,
        "FeedIn": 100.0,
        "Maxxisun": 0.0,
        "SelfConsumption": 300.0,
        "Consumption": 350.0,
    }


def test_maxxisun_feeding_adds_to_generation_and_charging_is_not_consumption() -> None:
    """-400 W for 7.5 min feeds 50 Wh, then +200 W for 7.5 min charges 25 Wh."""
    readings = counters(
        {"Production": 0.0, "Purchased": 0.0, "FeedIn": 0.0},
        {"Production": 0.0, "Purchased": 100.0, "FeedIn": 0.0},
    )
    power = [
        Reading(T0 - 5 * MIN, -400.0),
        Reading(T0 + timedelta(minutes=7.5), 200.0),
    ]
    point = interval_energy(T0, readings, maxxisun=power)
    assert point is not None
    assert point.fields["Maxxisun"] == 25.0
    assert point.fields["SelfConsumption"] == 50.0
    assert point.fields["Consumption"] == 125.0


def test_no_point_when_the_end_reading_is_stale() -> None:
    """A counter silent for >5 min at the interval end: the Pi or feed was down."""
    readings = counters(
        {"Production": 1000.0, "Purchased": 500.0, "FeedIn": 200.0},
        {"Production": 1400.0, "Purchased": 550.0, "FeedIn": 300.0},
    )
    readings["Purchased"] = [Reading(T0 - MIN, 500.0), Reading(T0 + 9 * MIN, 550.0)]
    assert interval_energy(T0, readings, maxxisun=[]) is None


def test_no_point_when_a_counter_has_no_reading_before_the_interval() -> None:
    """Without a start value the interval's energy is unknown (new counters)."""
    readings = counters(
        {"Production": 1000.0, "Purchased": 500.0, "FeedIn": 200.0},
        {"Production": 1400.0, "Purchased": 550.0, "FeedIn": 300.0},
    )
    readings["FeedIn"] = [Reading(T0 + 14 * MIN, 300.0)]
    assert interval_energy(T0, readings, maxxisun=[]) is None


def test_no_point_when_a_counter_went_backwards() -> None:
    """A meter reset or replacement must not produce negative energy."""
    readings = counters(
        {"Production": 1000.0, "Purchased": 500.0, "FeedIn": 200.0},
        {"Production": 900.0, "Purchased": 550.0, "FeedIn": 300.0},
    )
    assert interval_energy(T0, readings, maxxisun=[]) is None


def test_energy_across_an_outage_lands_in_the_first_interval_after_it() -> None:
    """The start value may be old: the counter difference is still exact."""
    readings = counters(
        {"Production": 1000.0, "Purchased": 500.0, "FeedIn": 200.0},
        {"Production": 3000.0, "Purchased": 550.0, "FeedIn": 300.0},
    )
    readings["Production"][0] = Reading(T0 - timedelta(hours=3), 1000.0)
    point = interval_energy(T0, readings, maxxisun=[])
    assert point is not None
    assert point.fields["Production"] == 2000.0


def test_quarter_hours_cover_only_completed_intervals() -> None:
    """From the first unwritten interval up to the last one that has fully ended."""
    now = T0 + timedelta(minutes=47)
    starts = list(quarter_hours(after=T0 - timedelta(minutes=15), now=now))
    assert starts == [T0, T0 + timedelta(minutes=15)]


def test_quarter_hours_start_on_a_boundary_and_skip_the_running_interval() -> None:
    """An unaligned resume point rounds down; the interval still running is excluded."""
    now = T0 + timedelta(minutes=18)
    starts = list(quarter_hours(after=T0 - timedelta(minutes=7), now=now))
    assert starts == [T0]


def test_quarter_hours_wait_until_the_last_reading_has_arrived() -> None:
    """An interval that ended a moment ago waits for its end readings to be logged."""
    now = T0 + timedelta(minutes=15, seconds=30)
    assert list(quarter_hours(after=T0 - timedelta(minutes=15), now=now)) == []
