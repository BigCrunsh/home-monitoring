# Capture the Maxxisun PV + battery system (PENDING — CCU2 API not yet open)

## Why

The household's second PV system (Maxxisun, with battery) is completely uncaptured:
no production, no battery state, no contribution to the energy model. Until it's
integrated, whole-house consumption is undercounted and autarky understated by up to
the Maxxi's output, and the future evcc automation can't reason about the battery.

**Status: PENDING.** The household runs the new **CCU2**, whose local API is still in
progress and not yet open. Existing community integrations
(ioBroker.maxxi-charge adapter, local REST-push patterns for the older CCU) may not
work against the CCU2 yet. This change stays blocked until the API is available;
task 1.1 is a periodic re-check.

## What Changes

(once the CCU2 API is open)

- Integrate the CCU2 locally (preferred: local REST push / adapter; no cloud
  dependency): production power, battery SoC, battery charge/discharge power.
- Persist to InfluxDB (new measurements or a `site` tag distinguishing the two PV
  systems in `electricity_power_watt`-style data — decided in design once the API
  shape is known).
- Extend the hybrid energy model in `solaredge_power.js`:
  `consumption = SE_production + maxxi_output + grid`; autarky then covers both
  systems correctly.
- Battery SoC tile on the dashboard; battery states available for
  `deploy-evcc-energy-automation`.

## Capabilities

### New Capabilities
- `maxxisun-monitoring`: capture requirements for the second PV system and its battery.

### Modified Capabilities
- (none yet — the `realtime-energy-states` delta follows in design once the API shape
  is known)

## Impact

- ioBroker (new adapter or script), InfluxDB schema addition, `solaredge_power.js`
  model extension, dashboard.
- External dependency: Maxxisun CCU2 local API availability (out of our control).
