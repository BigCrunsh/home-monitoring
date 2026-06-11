# Tasks

## 1. CI

- [x] 1.1 `.github/workflows/ci.yml`: Python 3.12; blocking job = `make check` +
      hermetic suite (`pytest -m "not integration"`, 136 tests). The 12
      `integration`-marked tests turned out to be live-system smoke tests
      (read-only, expect fresh production data) — excluded from CI by design,
      run manually against the live system
- [x] 1.2 `.travis.yml` deleted; CI badge in README
- [x] 1.3 Workflow green on master (first run, 38 s). Surfaced and fixed along the
      way: integration fixtures created the async client outside the event loop
      (suite was unrunnable: "Timeout context manager" — fixed with async
      fixtures); 17 ruff errors hidden behind the always-failing lint chain
      (test-rules moved to per-file-ignores; 2 production PLR0913 annotated for
      the tibber cleanup)
- [x] 1.4 mypy backlog burned to ZERO (was 37) and flipped to a blocking CI step.
      Beyond annotations, this hardened real fragility: Optional credential
      narrowing with explicit errors (Tibber/Tankerkoenig/SolarEdge/SAM),
      None-safe production accumulation in the tibber aggregations (the
      `month_production += sum(...)` path could have crashed on a drifted
      invariant), and typed JSON returns

## 2. Docs truthfulness

- [x] 2.1 `.ai/context.md` rewritten for the real architecture (was an unedited
      FastAPI/PostgreSQL template); `rules.md` requirements.txt reference fixed
- [x] 2.2 README fixed earlier (2026-06-10 README overhaul commit: measurements,
      log paths, crontab reality, supported-systems status)
- [x] 2.3 INFLUXDB_MEASUREMENTS_DOCUMENTATION.md cross-checked: all 25 live
      measurements documented

## 3. Tooling

- [x] 3.1 `requirements.txt` deleted; pyproject is the single source, verified by
      clean-room install + green suite. Never-imported deps removed (fastapi,
      solaredge, influxdb, netatmo, websocket-client); pandas/matplotlib moved
      to an [analysis] notebook extra; oauthlib kept (py-smart-gardena imports
      it without declaring it)
- [x] 3.2 Makefile: `check` = ruff + black --check (read-only, CI-safe);
      `lint` = check + type-check; `format` mutates
