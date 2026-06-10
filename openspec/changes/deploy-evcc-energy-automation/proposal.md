# Deploy evcc as the closed-loop energy automation sidecar

## Why

The setup measures everything and controls nothing: a measured 30-day price spread of
€0.095–€0.755/kWh (≈8×) on the Tibber tariff, PV covering ~94% of consumption on good
days, switchable actuators (HomeMatic plugs, Shelly) already installed — and zero
load-shifting logic. Decision (2026-06-10): add evcc as a sidecar next to the existing
stack (native Tibber + SolarEdge support) rather than hand-rolling ioBroker JS or
migrating to Home Assistant. Realistic upside €75–150/year plus the foundation for any
future EV/heat-pump control.

## What Changes

- evcc container on the Pi: Tibber tariff source, SolarEdge PV/grid source (prefer
  local Modbus TCP if the inverter supports it; cloud API fallback).
- One first controlled load wired up (device chosen in the spike task — candidates:
  hot-water/circulation via HomeMatic plug, dishwasher-style deferrable load via
  Shelly).
- Cheap-hour / PV-surplus scheduling for that load with a manual override.
- Decisions and shifted-consumption results observable (evcc UI + states; savings
  reviewed after 30 days).

## Capabilities

### New Capabilities
- `energy-automation`: requirements for price/PV-aware load control.

### Modified Capabilities
- (none)

## Impact

- Pi: new container (check RAM headroom), network access to inverter and Tibber API.
- Possibly inverter config (enable Modbus TCP) — verify model/firmware first.
- ioBroker remains the UI/state hub; evcc runs alongside (optional: bridge evcc states
  into ioBroker via MQTT for dashboard tiles).
- Depends on: `harden-network-services` (auth before adding services).
