"""The grid meter's phase-netted energy per 15 minutes, read from the Shelly Pro 3EM.

The Shelly's lifetime counters count import and export per phase, so the SolarEdge
exporting on one phase while another phase imports counts as both. The utility meter
nets the phases and bills neither. EMData.GetNetEnergies returns each phase's net
energy per period (Wh, positive = import); summed over the phases it is what the house
exchanged with the grid. The Shelly keeps these records itself, so a Pi outage loses
nothing.
"""

from datetime import UTC, datetime

import httpx

PERIOD_SECONDS = 900


async def grid_net_energy(
    http: httpx.AsyncClient, host: str, start: datetime, end: datetime
) -> dict[datetime, float]:
    """Return the house's net grid energy (Wh, + import, - export) per 15-minute start.

    Args:
        http: HTTP client
        host: the Shelly's network name
        start: first period start (UTC)
        end: end of the last period (UTC)

    Returns:
        Net energy by period start; periods without a Shelly record are absent
    """
    energy: dict[datetime, float] = {}
    ts, end_ts = int(start.timestamp()), int(end.timestamp())
    while ts < end_ts:
        response = await http.get(
            f"http://{host}/rpc/EMData.GetNetEnergies",
            params={"id": 0, "ts": ts, "end_ts": end_ts, "period": PERIOD_SECONDS},
        )
        response.raise_for_status()
        page = response.json()
        if "code" in page:
            raise ValueError(f"Shelly: {page.get('message')}")
        for block in page.get("data", []):
            for index, phases in enumerate(block["values"]):
                period_start = block["ts"] + index * block["period"]
                energy[datetime.fromtimestamp(period_start, tz=UTC)] = sum(phases)
        next_ts = page.get("next_record_ts")
        if not next_ts or next_ts <= ts:
            break
        ts = next_ts
    return energy
