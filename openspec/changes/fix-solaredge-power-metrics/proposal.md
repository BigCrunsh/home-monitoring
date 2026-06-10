# Fix always-zero Autarkie/Eigenverbrauch (SolarEdge consumption lag)

## Why

The dashboard's Autarkie and Eigenverbrauch tiles have effectively never shown a correct
value. Verified live: SolarEdge's consumption-meter fields arrive ~2 h later than
production/feed-in, so the newest rows in `electricity_power_watt` always have
`Consumption = 0` and an inflated `FeedIn` (observed `FeedIn 2,873 W > Production
2,350 W`, physically impossible). The deployed `solaredge_power.js` reads exactly that
newest row (`SELECT * ... ORDER BY DESC LIMIT 1`) every 5 minutes, yielding
`rate_autarky = 0/0`.

## What Changes

- `solaredge_power.js` computes real-time states from the newest **complete** row
  (consumption-side fields present) instead of the newest row.
- Publish a data-age state alongside the values so the dashboard can show staleness
  (consumed by `improve-dashboard-data-states`).
- Guard: never publish a state set where `FeedIn > Production`.
- Validate against live data across a lag window; sync the fixed script to the repo
  (via `version-iobroker-scripts` workflow).

## Capabilities

### New Capabilities
- `realtime-energy-states`: correctness requirements for the derived real-time energy
  states (power_*, rate_autarky, rate_selfconsumption).

### Modified Capabilities
- (none)

## Impact

- ioBroker script `solaredge_power` (deployed + repo copy).
- Dashboard tiles bound to `javascript.0.power_*` and `rate_*` states (Main + Energy
  views) start showing real values — expect visible behavior change.
- Depends on: `version-iobroker-scripts` for the deploy path (can be applied manually
  first if needed).
