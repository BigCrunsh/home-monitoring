"""Unit tests for reading the grid meter's phase-netted 15-minute energy.

The Shelly 3EM's lifetime counters count import and export per phase: the SolarEdge
exporting on phase A while phase C imports counts as both, although the utility meter
nets the phases and sees neither (7 Nov: 10.8 kWh "import" vs. 6.6 kWh on the meter).
EMData.GetNetEnergies gives each phase's net energy per period; summed over the phases
it is what the house exchanged with the grid.
"""

from datetime import UTC, datetime

import httpx
import pytest
from home_monitoring.services.energy_totals.shelly import grid_net_energy

HOST = "shellypro3em.test"
T0 = datetime(2026, 11, 7, 10, 0, tzinfo=UTC)
TS0 = int(T0.timestamp())


def client(pages: dict[int, dict]) -> httpx.AsyncClient:
    """A client whose Shelly answers each request by its `ts` parameter."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/rpc/EMData.GetNetEnergies"
        assert request.url.params["period"] == "900"
        return httpx.Response(200, json=pages[int(request.url.params["ts"])])

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio(scope="function")
async def test_phases_are_netted_per_period() -> None:
    """Phase A exporting 200 Wh while C imports 300 Wh is 110 Wh net import, not 310."""
    page = {"data": [{"ts": TS0, "period": 900, "values": [[-200.0, 10.0, 300.0]]}]}
    async with client({TS0: page}) as http:
        energy = await grid_net_energy(http, HOST, T0, T0.replace(minute=15))
    assert energy == {T0: 110.0}


@pytest.mark.asyncio(scope="function")
async def test_consecutive_periods_get_consecutive_start_times() -> None:
    """A block lists its periods in order from its start timestamp."""
    page = {
        "data": [
            {"ts": TS0, "period": 900, "values": [[1.0, 2.0, 3.0], [-9.0, 0.0, 1.0]]}
        ]
    }
    async with client({TS0: page}) as http:
        energy = await grid_net_energy(http, HOST, T0, T0.replace(minute=30))
    assert energy == {T0: 6.0, T0.replace(minute=15): -8.0}


@pytest.mark.asyncio(scope="function")
async def test_further_pages_are_fetched_until_the_end() -> None:
    """The Shelly answers long ranges in pages that point to the next record."""
    first = {
        "data": [{"ts": TS0, "period": 900, "values": [[1.0, 0.0, 0.0]]}],
        "next_record_ts": TS0 + 900,
    }
    second = {"data": [{"ts": TS0 + 900, "period": 900, "values": [[2.0, 0.0, 0.0]]}]}
    async with client({TS0: first, TS0 + 900: second}) as http:
        energy = await grid_net_energy(http, HOST, T0, T0.replace(minute=30))
    assert energy == {T0: 1.0, T0.replace(minute=15): 2.0}


@pytest.mark.asyncio(scope="function")
async def test_an_unreachable_shelly_raises() -> None:
    """No figures are invented: the collector run fails and the next one retries."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"code": -1})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(httpx.HTTPStatusError):
            await grid_net_energy(http, HOST, T0, T0.replace(minute=15))


@pytest.mark.asyncio(scope="function")
async def test_an_error_reply_raises() -> None:
    """The Shelly reports bad arguments as JSON with a code, not as HTTP errors."""
    page = {"code": -103, "message": "Missing or bad argument 'period'!"}
    async with client({TS0: page}) as http:
        with pytest.raises(ValueError, match="bad argument"):
            await grid_net_energy(http, HOST, T0, T0.replace(minute=15))
