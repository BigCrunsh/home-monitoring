# Project Context & Architecture

This file describes the system as it actually is. (It previously contained an
unedited FastAPI/PostgreSQL template — rewritten 2026-06-11.)

## What this project is

A home-monitoring system: cron-driven Python collectors pull metrics from vendor
APIs and write them to InfluxDB 1.8 on a Raspberry Pi. An ioBroker vis-2 dashboard
(wall tablet) visualizes them, fed by version-controlled ioBroker JavaScript
scripts that read InfluxDB and live sources (Shelly 3EM via MQTT). There is **no
API layer, no ORM, no web framework** in this repo.

## Tech Stack

- **Python**: 3.12 (the Pi runs the collectors via cron)
- **Storage**: InfluxDB 1.8 (InfluxQL), accessed with `aioinflux`
- **HTTP**: `httpx` (async, with timeouts)
- **Validation/config**: Pydantic v2 + pydantic-settings (`.env`)
- **Logging**: structlog (JSON, UTC)
- **Testing**: pytest, pytest-asyncio (asyncio_mode=auto), pytest-mock
- **Lint/format/types**: Ruff, Black, mypy (strict) — `make check` is read-only
- **Dependencies**: `pyproject.toml` only (no requirements.txt); `pip install -e ".[dev]"`
- **Dashboard side**: ioBroker JavaScript in `integrations/iobroker/` with
  export/deploy/drift tooling — the repo is the source of truth

## Project Structure

```
src/home_monitoring/
├── config.py           # pydantic-settings Settings (.env)
├── core/
│   ├── exceptions.py   # HomeMonitoringError hierarchy + ErrorCode enum
│   └── mappers/        # vendor API response -> Measurement objects
├── models/             # Measurement data model
├── repositories/
│   └── influxdb.py     # InfluxDBRepository (write, query, get_latest_timestamp)
├── services/           # one package per vendor (netatmo, solaredge, tibber,
│   │                   # tankerkoenig, sam_digital, gardena, techem, healthcheck)
│   └── base_service.py # shared init: settings + repository + logger
├── scripts/            # cron entry points (collect_*.py, healthcheck.py, update_dns.py)
└── utils/logging.py    # structlog setup, get_logger

integrations/iobroker/  # deployed ioBroker JS + vis layout + tools/
openspec/               # roadmap changes (proposals/specs/tasks) + main specs
tests/unit, tests/integration
```

## Architecture pattern

`scripts/collect_X.py` (cron, one-shot) → `services/X/service.py` (API calls,
orchestration) → `core/mappers/X.py` (parse to `Measurement`) →
`repositories/influxdb.py` (write). Services inherit `BaseService` (settings,
repository, logger injection — tests pass fakes via constructor kwargs).

Exceptions: raise the `core.exceptions` hierarchy (`APIError`, `ConfigurationError`,
`DatabaseError`), not bare ValueError. Scripts log structured errors and return
non-zero exit codes; cron captures logs to /home/pi/logs/.

## Testing Strategy

**Ratio: 1 happy : 2+ unhappy paths — mandatory for new code.** Unhappy paths:
invalid/missing data, API failures, timeouts, empty responses, boundary conditions.
Unit tests mock external dependencies (settings/repository injection, no network).
Integration tests require a local InfluxDB (see TESTING.md). Run the relevant
suite before declaring work done: `make check && make test-unit`.

## Conventions

- Type hints everywhere; mypy strict (a known backlog of ~30 legacy errors is
  being burned down — do not add new ones)
- Docstrings on public APIs (Args/Returns style, as in the existing code)
- Timestamps are timezone-aware UTC throughout
- Measurement naming: `<domain>_<metric>_<unit>` (e.g. `electricity_power_watt`)
- Commits: conventional commits, small logical units, one concern per commit
- Spec-driven changes: substantial work goes through OpenSpec
  (`openspec/changes/<id>/` — proposal, spec deltas, tasks); see ROADMAP.md
