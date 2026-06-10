# Add measurement freshness healthcheck with Telegram alerts

## Why

Pipeline deaths go unnoticed for months: the Netatmo rain gauge died 2025-12-30 and was
discovered 2026-06-10; all Gardena measurements are empty; wind has never produced data.
The system monitors the house but nothing monitors the system. A Telegram adapter is
already installed and used (`telegram_waschmaschine`), so alert delivery is essentially
free.

## What Changes

- New `healthcheck` script: queries the latest timestamp of every measurement in
  InfluxDB and compares against a per-measurement freshness SLA (e.g. weather 30 min,
  electricity 30 min, gas prices 2 h, heat 2 h).
- Sends a Telegram alert on staleness and a recovery notice when data resumes;
  deduplicates so a dead sensor alerts once per day, not hourly.
- Hourly cron entry; healthcheck failures themselves (InfluxDB unreachable) also alert.
- SLA table lives in config, not code.

## Capabilities

### New Capabilities
- `monitoring-healthcheck`: freshness monitoring and alerting for collected
  measurements.

### Modified Capabilities
- (none)

## Impact

- New `src/home_monitoring/scripts/healthcheck.py` + service/config code, tests.
- Crontab on the Pi; Telegram delivery via the ioBroker telegram adapter's REST
  endpoint or a direct bot token (decided in design).
- `.env.example` (telegram settings), README.
