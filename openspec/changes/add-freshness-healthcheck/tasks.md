# Tasks

## 1. Design decisions

- [x] 1.1 Telegram delivery via the ioBroker telegram adapter through the
      `iobroker message telegram.0 send` CLI — token stays in ioBroker, delivery
      reaches all known chats; trade-off (depends on ioBroker running on the same
      host) documented in the notifier
- [x] 1.2 SLA table in `conf/healthcheck.json`: 60 min for 5-min collectors, 180 min
      for SolarEdge (rows arrive ~60–75 min late), default 120; garden_* and
      wind/gust ignored (no hardware/source)

## 2. Implementation

- [x] 2.1 `HealthcheckService` (SHOW MEASUREMENTS + `get_latest_timestamp` per
      measurement, SLA evaluation)
- [x] 2.2 `AlertStore` (file-backed; dedup 24 h, recovery detection, corrupt-file
      tolerant)
- [x] 2.3 `TelegramNotifier` with timeout + failure propagation
- [x] 2.4 12 unit tests (10 unhappy / 2 happy): stale alerts, never-data alerts,
      dedup, 24 h reminder, recovery once, influx-down self-alert + dedup, default
      SLA, ignore list, notifier failure, corrupt state, config load, all-fresh

## 3. Deployment

- [x] 3.1 Hourly cron entry on the Pi (`30 * * * *`, logs to
      /home/pi/logs/healthcheck.log)
- [x] 3.2 Fire drill = first live run (2026-06-10): the genuinely stale
      `weather_rain_mm` (162 days) triggered a real Telegram alert; 15 measurements
      checked, ignore list effective. Recovery notice will fire when the rain-gauge
      batteries are replaced. (User confirmation of Telegram receipt pending.)
- [ ] 3.3 README: how to add/adjust SLAs
