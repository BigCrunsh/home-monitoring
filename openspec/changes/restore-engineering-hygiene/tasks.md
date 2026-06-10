# Tasks

## 1. CI

- [ ] 1.1 `.github/workflows/ci.yml`: Python 3.12, `make init`-equivalent install,
      `make test`
- [ ] 1.2 Delete `.travis.yml`; add status badge to README
- [ ] 1.3 Confirm the workflow is green on master (fix whatever it surfaces — mypy
      warnings noted in TESTING.md may need triage; flag, don't suppress)

## 2. Docs truthfulness

- [ ] 2.1 Rewrite `.ai/context.md` for the real architecture (collectors, mappers,
      InfluxDB repository, ioBroker integration; test ratio policy retained)
- [ ] 2.2 README: fix measurement list (SAM Digital heat measurements; Techem/Gardena
      marked disabled), remove `/var/log/home_monitoring` fiction
- [ ] 2.3 Cross-check INFLUXDB_MEASUREMENTS_DOCUMENTATION.md against live schema

## 3. Tooling

- [ ] 3.1 Delete `requirements.txt`; document `pip install -e ".[dev]"`; verify
      `make init` path
- [ ] 3.2 Makefile: `check` = ruff + mypy + black --check; `format` mutates; `lint`
      aliases `check`
