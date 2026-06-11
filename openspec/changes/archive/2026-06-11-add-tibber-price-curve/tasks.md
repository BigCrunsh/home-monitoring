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
- [x] 2.3 Placement: user reviewed on the tablet and chose to keep it on the
      **Energy view** (2026-06-11). Main stays uncluttered; can be copied to Main
      later via the vis editor + export_vis if ever wanted

## 3. Failure modes

- [x] 3.1 "kein Preis-Forecast verfügbar" fallback implemented and unit-smoke-tested
      (renders on empty result)
- [x] 3.2 13:00 publication boundary verified live (2026-06-11 15:25 Berlin:
      130 future slots, forecast extends to 2026-06-12 23:45 — at 13:45 it had
      only reached today). Midnight rollover uses the same mechanism (absolute
      slot timestamps + `now()-15m` window + Berlin day-separator) so it follows
      from the verified extension; left as a passive watch item, not a blocker
