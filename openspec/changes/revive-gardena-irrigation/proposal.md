# Revive the Gardena irrigation integration + dashboard panel

## Why

The household runs an actively-used 6-zone Gardena smart irrigation system
(Vorgarten, Garten, Hochbeet, Randbeet, Traufkiesstreifen, Dachterrasse) **with
soil-moisture sensors**. The monitoring integration was built (collector, mapper,
ioBroker valve script, vis intent) but has **never produced a single data point**
(`garden_*` measurements: 0 rows, all-time). Diagnosis (2026-06-12):

- The Python collector `collect_gardena_data.py` is a long-running **WebSocket
  daemon**, not a cron one-shot, and its cron line is commented out — so it has
  never run. Credentials are present in `.env`.
- A redundant ioBroker `smartgarden` adapter is "connected" but has 0 states;
  running both against one Gardena account collides with the API rate limits.

With soil sensors present, a wall panel can answer questions the Gardena app
doesn't surface at a glance — "did it water? does it need water? did it skip for
rain? is a sensor/valve dead?" — which is genuinely useful while away.

## What Changes

- **One integration path:** run `collect_gardena_data` as a **systemd service**
  (restart-on-failure) writing `garden_*` to InfluxDB; **disable** the redundant
  ioBroker `smartgarden` adapter.
- **Verify real data flows:** valve activity, soil moisture/temperature, light,
  battery, RF-link per zone.
- **Freshness monitoring, season-aware:** garden measurements rejoin the
  healthcheck, but irrigation is seasonal — off-season absence must read as
  "Saison aus", not a failure alert.
- **Dashboard panel:** a 6-zone irrigation tile — per-zone last-watered + soil
  moisture (color-banded) + a rain/forecast skip line (reusing Netatmo rain) +
  health surfaced only when bad.

## Capabilities

### New Capabilities
- `irrigation-monitoring`: capture + presentation requirements for the Gardena
  irrigation system.

### Modified Capabilities
- (none; healthcheck/monitoring-healthcheck requirements unchanged — the garden
  measurements move off the ignore list via config)

## Impact

- Pi: a systemd unit for the Gardena daemon; disable the `smartgarden` adapter;
  `conf/healthcheck.json` (garden SLAs, season-aware).
- ioBroker: `gardena_valve.js` (already in repo) consumes the now-live data; new
  vis panel.
- External dependency: the Gardena/Husqvarna API auth must be valid (creds set;
  may need re-auth) and the hardware must respond — verified during implementation.
- Prereq for the garden portion of `improve-dashboard-data-states`.
