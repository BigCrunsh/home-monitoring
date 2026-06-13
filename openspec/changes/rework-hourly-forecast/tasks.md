# Tasks

## 1. Data + secret
- [ ] 1.1 Extend openweathermap_weather.js: store hourly dt/temp/pop/icon (next 12h)
- [ ] 1.2 Read the OWM API key from an ioBroker state (not the committed file); set
      the state on the Pi; recommend rotating the key (it's in git history)

## 2. Visualization
- [ ] 2.1 Render the forecast strip SVG (temp curve + icons + rain bars + hour
      labels) to a state from the in-process hourly data
- [ ] 2.2 Replace the 24-cell cloud grid on the Weather view with one HTML widget

## 3. Verify + docs
- [ ] 3.1 Deploy; verify the strip renders with live data; no Invalid Date
- [ ] 3.2 README note (key location + rotation)
