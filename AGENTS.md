# AGENTS.md

Rules for any coding agent working in this repo. Tool-specific additions live beside it
(Claude Code: `CLAUDE.md`, which imports this file).

## What this repo is

A home-monitoring system that runs **live** on one Raspberry Pi. Python collectors
(`src/home_monitoring/`, run by cron) write vendor data into InfluxDB; an ioBroker vis-2
dashboard on a wall tablet is drawn by the version-controlled scripts in
`integrations/iobroker/`. Docs: `README.md` (setup, deploy cycle, measurements),
`integrations/iobroker/README.md` (script inventory), `integrations/iobroker/DESIGN_SYSTEM.md`
(dashboard components and colours), `openspec/` (planned changes and specs).

## Commands

| What | Command |
|---|---|
| Everything CI checks — run before every commit | `make verify` |
| Lint + format check + ioBroker script syntax and tests | `make check` |
| Types (mypy strict) | `make type-check` |
| No credentials anywhere in the git history | `make secrets` |
| Deploy one dashboard script to the Pi | `make deploy-script NAME=<script>` |
| Deploy the vis-2 layout to the Pi | `make deploy-vis` |

Use the repo virtualenv: append `PYTHON=.venv/bin/python` to the make commands. Add
`DRY_RUN=1` to a deploy to only run its drift check.

## Non-negotiables

- **Test first.** A failing test before every fix or feature; aim for two unhappy-path
  tests per happy-path one. Python tests in `tests/unit/`, dashboard tests in
  `tests/iobroker/` (`node --test`).
- **`make verify` green before every commit**, read from its exit code — not from
  output filtered through `grep`, which hides a failure.
- **Dashboard colours carry meaning.** `integrations/iobroker/DESIGN_SYSTEM.md` and the
  VC_PAL tokens in `integrations/iobroker/vis_card.js` are ground truth: never restyle,
  and check every visual change by rendering the published view states locally.
- **Deploy only with the make targets.** They refuse when the live copy was edited on the
  Pi or the local file is uncommitted. Never overwrite a refused live copy: commit the
  Pi-side edit first.
- **No credentials in the repo.** Keys and tokens live in the untracked `.env` (template:
  `.env.example`) and config on the Pi; never in code, tests, docs, commit messages or
  command output.
- **One concern per commit**, with a message that says what changed and why. Dashboard
  iterations go straight to `main`.

## The live system

The Pi is production: the dashboard on the wall and every alert come from it.

- Read-only inspection is always fine: `iob state get`, `iob object get`, logs, InfluxDB
  `SELECT`, `docker ps`. The `iob` CLI takes about 4.5 s per call — batch reads.
- Ask the owner before anything that deletes or rewrites live data or configuration:
  removing adapters or instances, InfluxDB `DROP`/`DELETE` or retention changes, removing
  containers, editing cron.
- The Pi's own git checkout is far behind and not kept current — never `git pull` there;
  deploy from the workstation.
