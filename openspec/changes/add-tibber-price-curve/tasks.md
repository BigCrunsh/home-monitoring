# Tasks

## 1. Data

- [ ] 1.1 Verify hourly price series availability: `tibber_states` / InfluxDB
      `electricity_prices_euro`; extend `tibber_states.js` to expose today+tomorrow
      series as a JSON state if needed
- [ ] 1.2 Reuse existing p20/p80 percentile states for the color bands

## 2. Chart

- [ ] 2.1 Install/configure the ECharts adapter (or evaluate vis-2 chart widget)
- [ ] 2.2 Build the price chart: hourly bars, percentile color bands, current-hour
      marker, de-DE labels
- [ ] 2.3 Place on Main view (replace/augment the Strompreis number tile); check
      legibility on the tablet at viewing distance

## 3. Failure modes

- [ ] 3.1 Implement and test the "no forecast" fallback (simulate by blanking the
      source state)
- [ ] 3.2 Confirm behavior across the 13:00 publication boundary and midnight rollover
