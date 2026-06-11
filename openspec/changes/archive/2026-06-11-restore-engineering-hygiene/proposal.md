# Restore engineering hygiene (CI, truthful docs, one dependency source)

## Why

`.travis.yml` targets Python 3.7 on a dead CI platform — nothing validates pushes.
`.ai/context.md` is an unedited FastAPI/PostgreSQL template that actively misleads any
contributor or AI assistant. Dependencies are declared in both `pyproject.toml` and
`requirements.txt` (out of sync). `make lint` reformats files (black) instead of
checking.

Verified consequences of the dead CI + dual manifests (2026-06-10, clean-room install):
- `pip install -e ".[dev]"` is broken on the project's own Python 3.12: `pyproject.toml`
  pins `pandas==2.0.3`, which predates 3.12 and fails to build from source.
- `requirements.txt` is missing runtime deps the code imports (`pydantic`,
  `pydantic-settings`, `structlog`, `httpx` unpinned).
- `pyproject.toml` declares `fastapi==0.110.0` — a ghost dependency from the template;
  nothing imports it.
- 5 tankerkoenig client tests fail on master under any pytest version: they test
  10-station API batching the client never implemented (see tracked follow-up).

## What Changes

- GitHub Actions workflow: `make test` (pytest + lint + type-check) on Python 3.12 for
  every push/PR; delete `.travis.yml`.
- Rewrite `.ai/context.md` to describe the real architecture (cron collectors →
  services → mappers → InfluxDB repository; no API layer, no ORM).
- Single dependency source: keep `pyproject.toml`, delete `requirements.txt`, document
  `pip install -e ".[dev]"`.
- Makefile: `check` (read-only) vs `format` (mutating) targets; `lint` no longer
  modifies files.
- README corrections: measurement list matches live schema (heat measurements from SAM
  Digital; `heat_energy_watthours` only when Techem is enabled).

## Capabilities

### New Capabilities
- `ci-pipeline`: continuous integration requirements.
- `project-docs`: documentation accuracy requirements.

### Modified Capabilities
- (none)

## Impact

- `.github/workflows/`, `.travis.yml` (deleted), `.ai/context.md`, `requirements.txt`
  (deleted), `Makefile`, `README.md`.
