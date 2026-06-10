# Show the Tibber 24 h price curve on the Main view

## Why

The dashboard shows the dynamic electricity price as a single number (`0,516 €/kWh`),
which is unactionable for a tariff whose entire point is hourly variation (measured
30-day spread €0.095–€0.755/kWh). The household can't see when to run loads. The data
already exists (hourly prices in InfluxDB and in `tibber_states`; Tibber publishes
tomorrow's prices ~13:00).

## What Changes

- A 24 h (today + tomorrow when published) hourly price chart on the Main view,
  color-banded by percentile (cheap/mid/expensive, reusing the existing p20/p80
  thresholds), with the current hour marked.
- ioBroker ECharts adapter (or equivalent vis-2 chart widget) fed from hourly price
  states; `tibber_states.js` extended to expose the forecast series if needed.
- Replaces or augments the current single-number Strompreis tile.

## Capabilities

### New Capabilities
- `dashboard-price-insight`: price-trend visualization requirements.

### Modified Capabilities
- (none)

## Impact

- ioBroker: new echarts adapter (install), `tibber_states.js` extension (via the
  version-controlled workflow), Main view layout (one prominent chart tile).
- No Python/collector changes expected.
