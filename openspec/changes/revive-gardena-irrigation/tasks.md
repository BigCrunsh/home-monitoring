# Tasks

## 1. Get data flowing (the precondition) — DONE

- [x] 1.1 Gardena auth verified live with the `.env` creds (OAuth 200, location +
      devices enumerated) — no re-auth needed. 4 devices: Bewässerung
      (SMART_IRRIGATION_CONTROL, 6 valves), Gemüsebeet (SOIL_SENSOR), Hochbeet +
      Dachterrasse (SENSOR)
- [x] 1.2 Single path: Python daemon → InfluxDB; redundant ioBroker `smartgarden`
      adapter **disabled**
- [x] 1.3 systemd unit `home-monitoring-gardena.service` (Restart=on-failure)
      installed + enabled on the Pi; active and running
- [x] 1.4 `garden_*` populate live: 6 valve zones (Vorgarten, Garten, Hochbeet,
      Randbeet, Traufkiesstreifen, Dachterrasse) + soil moisture, temperature,
      battery, RF link, light. Required three code fixes: write initial state
      (not only on WS change), run the blocking `start_ws` as a background task
      (everything after it was dead code), and map per-valve activity from the
      controller's `valves` dict (not a device-level state)

## 2. Monitoring (season-aware) — DONE

- [x] 2.1 `garden_*` removed from the healthcheck ignore list, given SLAs
      (valves/humidity/temp/light 60 min, battery/rf 24 h). Season note: when the
      system is winterized, move them back to ignore to avoid expected-absence
      alerts
- [x] 2.2 Verified live: healthcheck now covers 22 measurements incl. garden,
      sent=0 (all fresh)

## 3. Dashboard panel — PARTIAL

- [x] 3.1 `gardena_valve.js` confirmed live: the 6 zones' `valve_last_activity_*`
      states populate (each currently last = SCHEDULED_WATERING)
- [ ] 3.2 Build the irrigation panel in vis: per-zone last-watered + soil moisture
      color band + rain-skip line (Netatmo rain) + health-when-bad; seasonal
      off-state. (Design-iterate + mockup, like the price chart; respects the
      dashboard palette + leaves the nav untouched)
- [ ] 3.3 (covered by 3.2)

## 4. Documentation — TODO

- [ ] 4.1 README: Gardena runs as a systemd daemon (not cron); the panel; the
      single-path decision (adapter disabled)
