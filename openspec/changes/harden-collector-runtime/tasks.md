# Tasks

## 1. HTTP robustness

- [x] 1.1 Shared client factory `utils/http.make_async_client` (30s timeout, 10s
      connect) + `request_with_retries` (exponential backoff on transport errors
      and retryable 5xx; non-retryable responses returned for the caller)
- [x] 1.2 Adopted in all five service HTTP sites: SolarEdge (energy + power),
      SAM Digital, Tankerkoenig (prices + station detail). DNS service was retired
      separately, so no Dynu touchpoint remains
- [x] 1.3 7 helper tests (1 happy / 6 unhappy: retry-then-succeed on transport
      error, exhaust-and-raise, retry-on-5xx, non-retryable returns immediately,
      5xx-persists-returns-last, timeout factory); service tests updated to the
      new client path

## 2. Shell wrapper

- [x] 2.1 `run_home_monitoring.sh`: `set -euo pipefail`, per-module `flock -n`
      (skip+log `run_skipped_locked` instead of overlapping), `logsg`->`logs` fixed
- [x] 2.2 Verified live on the Pi: flock present (util-linux 2.36.1); lock files
      created per module (collect_netatmo_data, _sam_digital_data, _solaredge_data,
      _tankerkoenig_data, _tibber_data); full cron cycle clean post-deploy

## 3. Logging consistency

- [x] 3.1 All 7 collect_* scripts log failures via the structured logger (no
      bare print-to-stderr); redundant tibber print removed
- [x] 3.2 All scripts already call configure_logging(); verified structured
      output live (e.g. tankerkoenig now logs structured events)

## 4. Documentation

- [x] 4.1 README crontab/log-path section already corrected (earlier README
      overhaul: /home/pi/logs, real cadences, disabled jobs). Note recorded:
      Tankerkoenig free API is intermittently flaky (rate-limits/ok:false),
      pre-existing; self-heals on the */5 cadence and is covered by the
      freshness healthcheck's 60-min gas_prices SLA
