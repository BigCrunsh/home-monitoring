# Harden the collector runtime (timeouts, locking, logging)

## Why

Collectors call cloud APIs with no timeouts (`httpx.AsyncClient()` bare in SolarEdge and
SAM Digital services), so a slow API hangs a cron slot indefinitely; cron has no overlap
protection; `run_home_monitoring.sh` has no `set -euo pipefail` and a dead `logsg` path;
error reporting is inconsistent (structlog in some scripts, bare `print` to stderr in
others); the README documents a crontab and log paths that don't match the Pi.

## What Changes

- Shared HTTP client factory with a default timeout; retries with exponential backoff
  for transient failures across all services.
- `run_home_monitoring.sh`: `set -euo pipefail`, `flock` per collector to prevent
  overlapping runs, remove the `logsg` dead path.
- All scripts use structured logging (no bare `print` for errors).
- README scheduling/log-path sections corrected to match the actual crontab
  (`/home/pi/logs/`, actual cadences, disabled jobs noted).

## Capabilities

### New Capabilities
- `collector-runtime`: runtime robustness requirements for cron collectors.

### Modified Capabilities
- (none)

## Impact

- `run_home_monitoring.sh`, all `services/*/service.py` HTTP usage, all
  `scripts/collect_*.py`, README, tests.
- Pi crontab unchanged in cadence; behavior change: hung collectors now fail fast.
