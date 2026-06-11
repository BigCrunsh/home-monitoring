# Tasks

## 1. Data

- [x] 1.1 Forecast data path built: new `electricity_price_forecast_euro` measurement
      (Python collector stores the published curve at the hours' own timestamps).
      Discovery: Tibber now publishes **15-minute** resolution (96 slots/day,
      Germany's 2025 quarter-hour settlement) — the chart renders 15-min bars.
      First deploy caught a pyTibber API difference (no `update_price_info`;
      `update_info_and_price_info` is correct) — graceful error path worked
- [x] 1.2 7-day p20/p80 percentile states reused for the color bands

## 2. Chart

- [x] 2.1 Evaluated ECharts adapter vs hand-rolled: the echarts adapter charts
      *state history* and cannot render future series — hand-rolled SVG in
      `tibber_states.js` instead (`price_forecast_chart` state, rebuilt every
      5 min; bars colored by percentile, current slot highlighted with price,
      day separators + hour ticks in Europe/Berlin)
- [x] 2.2 Chart deployed and rendering (48 bars at first run, grows to ~144 once
      tomorrow publishes)
- [ ] 2.3 Placement: widget added to the **Energy view** (Main view is dense; spec
      preferred Main). User to judge on the tablet and drag/copy it to Main in
      the vis editor if wanted, then `export_vis.sh` + commit

## 3. Failure modes

- [x] 3.1 "kein Preis-Forecast verfügbar" fallback implemented and unit-smoke-tested
      (renders on empty result)
- [ ] 3.2 Verify the 13:00 publication boundary live (chart should extend to
      tomorrow) and the midnight rollover
