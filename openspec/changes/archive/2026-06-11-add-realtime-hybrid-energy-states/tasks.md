# Tasks

## 1. Implement

- [x] 1.1 Rework `solaredge_power.js`: read live Shelly grid state + newest SolarEdge
      production row; hybrid computation with physical-bounds clamping
- [x] 1.2 Fallback chain: Shelly stale → complete-row mode (existing logic);
      nothing usable → stale path keeping previous values
- [x] 1.3 Add `power_calc_mode` state; `power_data_age_seconds` = production row age
      in hybrid mode; schedule tightened to every minute
- [x] 1.4 Event-driven recompute: subscribe to the Shelly grid state (~10 s) and
      recompute from a cached production row, so Main view tiles react in seconds
      like the Energy tab (user feedback 2026-06-10; InfluxDB query stays at 1/min)

## 2. Validate

- [x] 2.1 Dry-run hybrid math against live Shelly + InfluxDB values before deploy
      (grid +6 W @3 s, production 403 W → autarky 98.6%, all plausible)
- [x] 2.2 Deployed 2026-06-10; mode = hybrid, purchased 4.0 W vs live Shelly 3.5 W,
      consumption 357 W, autarky 98.9%; no new warnings. Calibration finding:
      SolarEdge publishes power rows ~60–75 min late (not ~15 min) → production gate
      set to 2 h; truly live production needs Modbus TCP (evcc change)
- [x] 2.3 Fallback verified live: `solaredge` mode engaged while the production gate
      was mis-calibrated and transitioned back to `hybrid` after the fix (mode state
      observable throughout). Shelly-stale path uses the same gate logic.

## 3. Sync & document

- [x] 3.1 Commit the script to `integrations/iobroker/`
- [x] 3.2 ROADMAP: near-real-time noted in the P4 row incl. the Maxxisun
      autarky-understated caveat; Pi timezone finding recorded as a chore
