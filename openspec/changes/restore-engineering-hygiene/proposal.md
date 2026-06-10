# Restore engineering hygiene (CI, truthful docs, one dependency source)

## Why

`.travis.yml` targets Python 3.7 on a dead CI platform — nothing validates pushes.
`.ai/context.md` is an unedited FastAPI/PostgreSQL template that actively misleads any
contributor or AI assistant. Dependencies are declared in both `pyproject.toml` and
`requirements.txt` (out of sync). `make lint` reformats files (black) instead of
checking.

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
