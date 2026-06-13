# Tasks

## 1. Data + secret — DONE

- [x] 1.1 openweathermap_weather.js stores hourly dt/temp/pop/icon/clouds (next 12h)
- [x] 1.2 OWM API key read from the `javascript.0.owm_apikey` state (set on the Pi),
      not the committed file; empty key logs a clear error.
      **User action: rotate the key at openweathermap.org** (it's in git history)

## 2. Visualization — DONE

- [x] 2.1 Forecast strip SVG: temp curve + condition icons + **sun % (=100-clouds,
      PV-yield proxy, amber)** + rain-probability bars (blue) + Berlin hour labels +
      header legend; classic palette
- [x] 2.2 Replaced the 24-cell cloud grid (container + 24 cells) with one HTML widget
      bound to `weather_hourly_forecast`

## 3. Verify + docs — DONE

- [x] 3.1 Deployed; verified live: 12 h, real temps, sun % per hour (3–93%), rain
      bars, icons, hour labels — no Invalid Date / no overlap
- [x] 3.2 README security note: secret-in-state pattern + key-rotation reminder
