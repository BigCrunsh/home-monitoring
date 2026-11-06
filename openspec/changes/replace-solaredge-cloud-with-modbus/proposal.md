# Replace the SolarEdge cloud feed with local meter counters

## Why

SolarEdge retired its Monitoring API v1 on 2026-11-03; every request now returns 410 Gone.
Since then `electricity_energy_watthour` and `electricity_power_watt` are stale, the
healthcheck alerts twice a day, and `solaredge_power.js` has lost the fallback it used
while the inverter sleeps, so the live energy states freeze in those moments.

The cloud was never the ground truth: its production figure comes from the inverter's own
lifetime counter, which Modbus TCP reads directly, and the grid's ground truth is the
utility meter, which Tibber already reports daily. The replacement API (v2) would add an
OAuth app, a ~66-calls-a-day limit and a paywalled meter split for no better data.

## What Changes

- `solaredge_modbus.js` also reads the inverter's lifetime AC energy counter;
  `mqtt_shelly.js` also publishes the grid meter's lifetime import and export counters.
  All three are logged to InfluxDB (database `iobroker`).
- `collect_solaredge_data` computes 15-minute energy from counter differences instead of
  calling the cloud and writes it to `electricity_energy_watthour` with the same fields
  and tags, so the history and its consumers continue. The Maxxisun's share comes from
  its metered power. Its cron entry is unchanged.
- `electricity_power_watt` is no longer written; `solaredge_power.js` drops the cloud
  fallback: an inverter that is offline after sunset counts as 0 W production, an
  inverter offline in daylight leaves the states stale.
- The healthcheck compares yesterday's grid import from the Shelly counter with the
  utility meter's figure (Tibber) once a day and alerts on a large difference.
- The SolarEdge cloud client, its config and its tests are removed.

## Capabilities

### New Capabilities
- `energy-totals`: energy per 15 minutes from meter counters.

### Modified Capabilities
- `realtime-energy-states`: no cloud fallback; night-time production is 0 W.
- `monitoring-healthcheck`: a daily reconciliation against the utility meter.

## Impact

- ioBroker scripts `solaredge_modbus.js`, `mqtt_shelly.js`, `solaredge_power.js`;
  influxdb adapter logging for three new states.
- Python: `collect_solaredge_data`, the SolarEdge service and mapper, the healthcheck,
  `conf/healthcheck.json`, `.env.example` (SolarEdge API key no longer needed).
- `electricity_energy_watthour` continues with a different source; the `site_id` tag is
  kept so existing queries keep matching.
