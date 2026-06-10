# Anchor real-time energy states on the Shelly grid meter

## Why

After `fix-solaredge-power-metrics`, the dashboard energy states are correct but ~2 h
behind (SolarEdge cloud consumption lag). The Shelly 3EM at the grid connection point
already publishes live grid power (verified: updates every ~10 s via MQTT) and is the
only device that sees the whole house — including the second, currently uncaptured
Maxxisun PV+battery system. Anchoring the energy balance on the Shelly makes
purchase/feed-in exact and seconds-fresh, and autarky near-real-time.

## What Changes

- `solaredge_power.js` computes the published states from the grid-point anchor:
  `grid` = live Shelly `total_act_power`; `production` = newest SolarEdge row
  (measured: SolarEdge publishes power rows ~60–75 min late — no completeness wait,
  but not 15 min as initially assumed; truly live production needs Modbus TCP);
  `consumption = production + grid`, `purchased = max(0, grid)`,
  `feedin = max(0, −grid)`, `selfconsumption = production − feedin`,
  `autarky = 1 − purchased / consumption`.
- Fallback chain: if the Shelly state is stale (> 5 min) the script falls back to the
  previous newest-complete-row mode; if that also fails, the stale path applies.
- New `power_calc_mode` state (`hybrid` | `solaredge` | `stale`) so the active mode is
  observable; `power_data_age_seconds` reflects the dominant (production) input age.
- The production input is deliberately swappable: SolarEdge Modbus TCP (local, ~1 s)
  can replace the cloud term later without changing the model (planned within
  `deploy-evcc-energy-automation`).

## Known limitation (until `add-maxxisun-integration`)

The Maxxisun system is invisible, so computed consumption omits its output and
**autarky is understated** (the Maxxi's contribution reduces grid import but isn't
counted as self-made energy). Purchase and feed-in are exact regardless.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `realtime-energy-states`: states anchor on the grid-point meter instead of waiting
  for complete SolarEdge meter rows (delta adds hybrid requirements; the
  complete-row logic from `fix-solaredge-power-metrics` becomes the fallback).

## Impact

- ioBroker script `solaredge_power` (deployed + repo copy in `integrations/iobroker/`).
- Dashboard tiles update semantics: values become near-real-time; Autarkie may differ
  visibly from the SolarEdge app (which is SE-only and lagged).
- Depends on the `mqtt_shelly` script's states remaining available.
