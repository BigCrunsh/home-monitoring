# Capture the Maxxisun PV + battery system (metered at its socket)

## Why

The household's second PV system (Maxxisun, with battery) was completely uncaptured:
no production, no battery state, no contribution to the energy model. Without it,
whole-house consumption is undercounted and autarky understated by up to the Maxxi's
output.

**Scope: metering only.** The household's controller is a **CCU V2**, which opens no
local interface (no API, MQTT or Modbus; MQTT control exists only on the V2+). Battery
state of charge and the panel-vs-battery split therefore cannot be captured, and the
CCU cannot be controlled from ioBroker. The former phase B (full CCU integration) was
dropped on 2026-11-05 for that reason.

## What Changes

- Meter the Maxxi's AC flow at its socket with a Shelly Plug S Gen3 (signed power:
  negative = feeding the house, positive = charging), bridged into
  `javascript.0.power_maxxisun`.
- Extend the hybrid energy model in `solaredge_power.js`:
  `consumption = SE_production + maxxi_output + grid`; autarky then covers both
  systems.
- Persist the Maxxi power to InfluxDB and watch it with the freshness healthcheck.
- Show the Maxxi's share on the dashboard.

## Capabilities

### New Capabilities
- `maxxisun-monitoring`: metering requirements for the second PV system.

### Modified Capabilities
- (none)

## Impact

- ioBroker (Shelly plug via MQTT), `solaredge_power.js` model extension, InfluxDB,
  healthcheck SLA, dashboard.
