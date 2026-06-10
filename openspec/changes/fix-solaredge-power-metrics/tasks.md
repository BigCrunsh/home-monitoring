# Tasks

## 1. Fix

- [x] 1.1 Rewrite the InfluxQL in `solaredge_power.js`: newest row WHERE consumption
      fields present, bounded to last 6 h. (Implemented as JS-side selection over the
      last-6h rows — InfluxQL cannot compare two fields, and the completeness check
      needs `FeedIn ≤ Production` too.)
- [x] 1.2 Add the `FeedIn > Production` completeness guard (1 W tolerance)
- [x] 1.3 Publish `power_data_age_seconds` state (plus `power_data_stale` boolean;
      note: the influxdb adapter returns row timestamps as `ts` in ms, not `time`)
- [x] 1.4 Handle the no-complete-row case: set `power_data_stale`, keep previous values

## 2. Validate (against live data)

- [x] 2.1 Compared published states against manual InfluxQL during an active lag
      window (2026-06-10 ~17:30): script skipped 2 incomplete rows (C=0,
      FeedIn>Production), picked 14:45Z; autarky 100% at 395 W house load /
      1263 W production; energy balance consistent; age 6636 s
- [ ] 2.2 Check overnight behavior (no production): autarky → 0 legitimately,
      self-consumption rate handled without division-by-zero artifacts
      (logic guards in place; verify on live data after one night)
- [ ] 2.3 Confirm the Energy view tiles and Main view tiles update accordingly
      (states verified; needs a glance at the wall tablet)

## 3. Sync

- [x] 3.1 Commit the fixed script to `integrations/iobroker/` (per
      version-iobroker-scripts workflow)
- [x] 3.2 Note the behavior change in ROADMAP/README (dashboard now shows real autarky)
