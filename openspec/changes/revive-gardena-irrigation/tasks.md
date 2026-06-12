# Tasks

## 1. Get data flowing (the precondition)

- [ ] 1.1 Verify Gardena auth works with the `.env` credentials (run the collector
      interactively; confirm it connects and enumerates the real devices/zones).
      Re-auth if the token/app credentials are stale — **may need the user**
- [ ] 1.2 Choose the single path: Python WebSocket daemon → InfluxDB. **Disable**
      the redundant ioBroker `smartgarden` adapter (avoid API rate-limit collision)
- [ ] 1.3 systemd unit for `collect_gardena_data` (Restart=on-failure,
      WantedBy=multi-user); deploy + enable on the Pi (user-approved)
- [ ] 1.4 Confirm `garden_*` measurements populate: valve activity + soil moisture
      + temperature + battery + RF link, for the expected zones

## 2. Monitoring (season-aware)

- [ ] 2.1 Remove `garden_*` from the healthcheck ignore list; add SLAs. Make the
      check season-aware (no off-season alerts) — config-driven
- [ ] 2.2 Verify a real stall in-season would alert (fire drill)

## 3. Dashboard panel

- [ ] 3.1 Confirm/deploy `gardena_valve.js` against live `garden_valves_activity`;
      add soil-moisture + health states
- [ ] 3.2 Build the 6-zone irrigation panel in vis (last-watered, soil moisture
      color band, rain-skip line from Netatmo rain, health-when-bad), seasonal
      off-state; deploy via the versioned vis tooling
- [ ] 3.3 (optional) Produce a mockup first for sign-off before building

## 4. Documentation

- [ ] 4.1 README: Gardena now runs as a systemd daemon (not cron); the panel; the
      single-path decision and why the adapter is disabled
