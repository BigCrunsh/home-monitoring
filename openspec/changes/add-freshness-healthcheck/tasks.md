# Tasks

## 1. Design decisions

- [ ] 1.1 Choose Telegram delivery path: ioBroker telegram adapter (simple-api/REST) vs.
      direct bot token from Python; record in design.md
- [ ] 1.2 Define the SLA table (per measurement) with the actual cron cadences as input

## 2. Implementation

- [ ] 2.1 Healthcheck service: query latest timestamp per measurement, evaluate SLAs
- [ ] 2.2 Alert state store (last-alerted timestamps) for dedup + recovery detection
- [ ] 2.3 Telegram notifier with failure handling
- [ ] 2.4 Tests, 2:1 unhappy:happy — stale measurement alerts; recovery notice; influx
      down alerts; dedup suppresses repeats; unknown measurement uses default; happy:
      all fresh → silent

## 3. Deployment

- [ ] 3.1 Cron entry on the Pi (hourly), log file alongside the other collectors
- [ ] 3.2 Fire-drill: temporarily set an SLA to 1 minute and confirm the Telegram
      message arrives; confirm recovery notice
- [ ] 3.3 README: how to add/adjust SLAs
