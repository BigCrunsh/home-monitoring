# Tasks

## 1. Fix

- [ ] 1.1 Rewrite the InfluxQL in `solaredge_power.js`: newest row WHERE consumption
      fields present (e.g. `Consumption > 0 OR Purchased > 0`), bounded to last 6 h
- [ ] 1.2 Add the `FeedIn > Production` completeness guard
- [ ] 1.3 Publish `power_data_age_seconds` (or timestamp) state
- [ ] 1.4 Handle the no-complete-row case: mark stale, do not publish zeros

## 2. Validate (against live data)

- [ ] 2.1 Compare published states against manual InfluxQL across a morning (lag window
      moving) — autarky must be plausible (>0 during PV production with house load)
- [ ] 2.2 Check overnight behavior (no production): autarky → 0 legitimately,
      self-consumption rate handled without division-by-zero artifacts
- [ ] 2.3 Confirm the Energy view tiles and Main view tiles update accordingly

## 3. Sync

- [ ] 3.1 Commit the fixed script to `integrations/iobroker/` (per
      version-iobroker-scripts workflow)
- [ ] 3.2 Note the behavior change in ROADMAP/README (dashboard now shows real autarky)
