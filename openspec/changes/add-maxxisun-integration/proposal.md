# Capture the Maxxisun PV + battery system (PENDING — CCU2 API not yet open)

## Why

The household's second PV system (Maxxisun, with battery) is completely uncaptured:
no production, no battery state, no contribution to the energy model. Until it's
integrated, whole-house consumption is undercounted and autarky understated by up to
the Maxxi's output, and the future evcc automation can't reason about the battery.

**Status: phase A unblocked / phase B PENDING.** The household runs the new **CCU2**,
whose local API is still in progress and not yet open, so the full integration
(battery SoC, charge/discharge, panel-vs-battery split) stays blocked; task 1.1 is a
periodic re-check.

**Phase A (no API needed):** meter the Maxxi's output at its feed-in socket with an
existing HomeMatic metering plug (HmIP-PSM-style, `.6.POWER` channel — already used
elsewhere in the house). That yields `maxxi_output` for the whole-house model
(`consumption = SE_production + maxxi_output + grid`) and a "davon Maxxi" dashboard
value. Direction caveat: the plug meters reverse flow only de facto (community-proven,
not officially specified) — phase A starts with an empirical plausibility check.
What phase A cannot provide: battery SoC and the split between Maxxi panel and
battery — that remains phase B (CCU2 API).

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
