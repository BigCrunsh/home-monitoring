"""Unit tests for 15-minute energy from the inverter counter and the grid meter.

The SolarEdge cloud that delivered these totals was retired on 2026-11-03. Production
comes from the inverter's lifetime counter (Wh, logged about once a minute), the grid
exchange from the Shelly's phase-netted energy per interval (Wh, + import, - export),
and the Maxxisun's share from its signed power (negative = feeding the house).
"""

from datetime import UTC, datetime, timedelta

from home_monitoring.services.energy_totals import (
    Reading,
    interval_energy,
    quarter_hours,
)

T0 = datetime(2026, 11, 6, 10, 0, tzinfo=UTC)
MIN = timedelta(minutes=1)


def production(start: float, end: float) -> list[Reading]:
    """Counter readings one minute before the interval start and before its end."""
    return [Reading(T0 - MIN, start), Reading(T0 + 14 * MIN, end)]


def test_an_importing_interval_splits_into_purchase_and_production() -> None:
    """400 Wh produced, 50 Wh net from the grid: the house used 450 Wh."""
    point = interval_energy(T0, production(1000.0, 1400.0), grid_net=50.0, maxxisun=[])
    assert point is not None
    assert point.timestamp == T0
    assert point.measurement == "electricity_energy_watthour"
    assert point.fields == {
        "Production": 400.0,
        "Purchased": 50.0,
        "FeedIn": 0.0,
        "Maxxisun": 0.0,
        "SelfConsumption": 400.0,
        "Consumption": 450.0,
    }


def test_an_exporting_interval_is_feed_in_not_negative_purchase() -> None:
    """400 Wh produced, 100 Wh net to the grid: 300 Wh used in the house."""
    point = interval_energy(
        T0, production(1000.0, 1400.0), grid_net=-100.0, maxxisun=[]
    )
    assert point is not None
    assert point.fields["Purchased"] == 0.0
    assert point.fields["FeedIn"] == 100.0
    assert point.fields["SelfConsumption"] == 300.0
    assert point.fields["Consumption"] == 300.0


def test_maxxisun_feeding_adds_to_generation_and_charging_is_not_consumption() -> None:
    """-400 W for 7.5 min feeds 50 Wh, then +200 W for 7.5 min charges 25 Wh."""
    power = [
        Reading(T0 - 5 * MIN, -400.0),
        Reading(T0 + timedelta(minutes=7.5), 200.0),
    ]
    point = interval_energy(T0, production(0.0, 0.0), grid_net=100.0, maxxisun=power)
    assert point is not None
    assert point.fields["Maxxisun"] == 25.0
    assert point.fields["SelfConsumption"] == 50.0
    assert point.fields["Consumption"] == 125.0


def test_no_point_without_the_grid_meter_record() -> None:
    """The Shelly had no record for the interval: its energy is unknown."""
    readings = production(1000.0, 1400.0)
    assert interval_energy(T0, readings, grid_net=None, maxxisun=[]) is None


def test_no_point_when_the_production_reading_is_stale() -> None:
    """The inverter counter silent for >5 min at the interval end: the feed was down."""
    readings = [Reading(T0 - MIN, 1000.0), Reading(T0 + 9 * MIN, 1400.0)]
    assert interval_energy(T0, readings, grid_net=50.0, maxxisun=[]) is None


def test_no_point_without_a_production_reading_before_the_interval() -> None:
    """Without a start value the interval's production is unknown (new counter)."""
    readings = [Reading(T0 + 14 * MIN, 1400.0)]
    assert interval_energy(T0, readings, grid_net=50.0, maxxisun=[]) is None


def test_no_point_when_the_production_counter_went_backwards() -> None:
    """A reset or replaced inverter must not produce negative energy."""
    readings = production(1000.0, 900.0)
    assert interval_energy(T0, readings, grid_net=50.0, maxxisun=[]) is None


def test_production_across_an_outage_lands_in_the_first_interval_after_it() -> None:
    """The start value may be old: the counter difference is still exact."""
    readings = [
        Reading(T0 - timedelta(hours=3), 1000.0),
        Reading(T0 + 14 * MIN, 3000.0),
    ]
    point = interval_energy(T0, readings, grid_net=0.0, maxxisun=[])
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
