# Tasks

## 1. HTTP robustness

- [ ] 1.1 Shared client factory (timeout default, optional retry policy via tenacity)
- [ ] 1.2 Adopt in SolarEdge, SAM Digital, Tankerkoenig, Tibber, DNS services
- [ ] 1.3 Tests 2:1 unhappy:happy per service touchpoint: timeout raises within budget;
      retry succeeds after transient 5xx; retry budget exhausted fails; happy path
      unchanged

## 2. Shell wrapper

- [ ] 2.1 `run_home_monitoring.sh`: `set -euo pipefail`, `flock -n` keyed by module
      name, drop `logsg`
- [ ] 2.2 Manual test on the Pi: parallel invocation skips; failing module exits
      non-zero into the cron log

## 3. Logging consistency

- [ ] 3.1 Replace `print(..., file=sys.stderr)` with structured logger in
      collect_solaredge_data, collect_techem_data, collect_gardena_data
- [ ] 3.2 Verify all scripts call `configure_logging()`

## 4. Documentation

- [ ] 4.1 README: real crontab (cadences, disabled Gardena/Techem jobs), real log path
      `/home/pi/logs/`, logrotate note
