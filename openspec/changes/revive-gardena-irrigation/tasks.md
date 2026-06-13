# Tasks

## 1. Get data flowing (the precondition) — DONE

- [x] 1.1 Gardena auth verified live (OAuth 200, devices enumerated) — no re-auth.
      4 devices: Bewässerung (SMART_IRRIGATION_CONTROL, 6 valves), Gemüsebeet
      (SOIL_SENSOR), Hochbeet + Dachterrasse (SENSOR)
- [x] 1.2 Single path: Python daemon → InfluxDB; ioBroker `smartgarden` disabled
- [x] 1.3 systemd unit `home-monitoring-gardena.service` installed + enabled; running
- [x] 1.4 `garden_*` populate live (6 valve zones + soil moisture/temp/battery/rf/
      light). Three code fixes: write initial state, run blocking `start_ws` as a
      background task, map per-valve activity from the controller's `valves` dict

## 2. Monitoring (season-aware) — DONE

- [x] 2.1 `garden_*` off the ignore list, SLAs added (season note: re-ignore when
      winterized)
- [x] 2.2 Verified: healthcheck covers 22 measurements incl. garden, all fresh

## 3. Dashboard panel — DONE

- [x] 3.1 `gardena_valve.js` valve states populate (real last-watering times)
- [x] 3.2 Bewässerung panel built (SVG renderer folded into `gardena_valve.js` —
      iobroker can't CLI-create a new object) and deployed to the **Weather view**.
      Mockup approved by the user; built from real values; classic palette; nav
      untouched. Live render verified (moisture bars, real last-watered times,
      battery warnings on the two dying sensors, rain shown unavailable)

## 4. Documentation — DONE

- [x] 4.1 README: Gardena moved to active systems — systemd daemon (not cron),
      adapter disabled (single path), panel on the Weather view

## Follow-up chores (not blockers)

- [ ] Replace the soil-sensor batteries (Hochbeet 0%, Dachterrasse 2% — surfaced
      by the new panel) and the Netatmo rain-gauge battery (unblocks the rain line)
