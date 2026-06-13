# Rework the hourly forecast panel + secure the OWM key

## Why

The Weather view's lower "prediction hours" panel shows only hourly **cloud
cover %** in a 24-cell grid with no time axis, no labels, no units, and cell
colours bound to unrelated `daswetter…Day_N` temperature percentiles (a
copy-paste artifact). It answers none of the questions an hourly forecast should
("will it rain? how warm?"), despite the OpenWeatherMap One Call API already
returning hourly temp / precipitation-probability / condition. Separately, the
**OWM API key is hardcoded** in `openweathermap_weather.js`, which is in the
public repo.

## What Changes

- Extend `openweathermap_weather.js` to store the hourly `temp`, `pop`
  (precipitation probability), `icon`, and `dt` it already fetches (next ~12 h),
  and render a forecast **strip SVG** to a state: temperature curve + per-hour
  condition icon + rain-probability bars + hour labels (classic palette).
- Replace the 24-cell cloud grid on the Weather view with one HTML widget bound
  to the new state.
- Move the OWM API key out of the committed script into an ioBroker state set on
  the Pi (not in git). Note: the key is already in git history → the real fix is
  rotating it at openweathermap.org.

## Capabilities

### New Capabilities
- `hourly-forecast`: presentation + data requirements for the hourly weather panel.

### Modified Capabilities
- (none)

## Impact

- `integrations/iobroker/openweathermap_weather.js` (existing object), the Weather
  vis view (remove grid, add widget), an ioBroker secret state, README note.
