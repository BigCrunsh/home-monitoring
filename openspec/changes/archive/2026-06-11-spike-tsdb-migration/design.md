# TSDB successor — evaluation result (2026-06-11)

## Recommendation

**Migrate to InfluxDB 3 (Core, or the free at-home Enterprise tier) — but only
after `upgrade-pi-os`.** Until then: stay on contained 1.8 (localhost-bound per
`harden-network-services`). Risk accepted: EOL, LAN-only.

## The decisive constraints (measured, not assumed)

- **The database is tiny**: 42 MB, 74 series. Migration cost is entirely in the
  integration surface, never in the data.
- **The Pi is 32-bit (armv7)**: no modern TSDB ships for it (InfluxDB 3 is
  64-bit Rust; VictoriaMetrics armv7 builds are niche). **Hard sequencing:
  `upgrade-pi-os` (64-bit) precedes any migration.**
- **The integration surface is v1-API InfluxQL on both sides**: aioinflux
  (Python) and the ioBroker adapter/JS scripts (incl. PERCENTILE subqueries,
  `last(*)` with tag grouping).

## Dry-run evidence (Mac, docker `influxdb:3-core`, real data)

- 415,218 points (30 days, all 26 measurements) exported from the Pi as line
  protocol and imported through the **v1-compat `/write`** endpoint: zero errors.
- **Point counts match exactly** for all 26 measurements (Pi 1.8 vs v3).
- The exact production InfluxQL queries work on the **v1-compat `/query`**
  endpoint: `SELECT * ... ORDER BY time DESC LIMIT n` (solaredge_power),
  `MIN/MAX/PERCENTILE` over a `LAST(...) GROUP BY time(1d)` subquery
  (tibber_states), `last(*) ... GROUP BY period`.
- **aioinflux works unchanged** against v3 (read and write verified).

## Candidates compared

| Candidate | Write path | Query path (JS InfluxQL) | armv7 today | Verdict |
|---|---|---|---|---|
| **InfluxDB 3** | v1-compat, verified | v1-compat, verified incl. PERCENTILE/subqueries | no (needs 64-bit OS) | **Winner — near-zero code change** |
| VictoriaMetrics | line protocol, easy | ✗ no InfluxQL → rewrite ~10 JS queries to MetricsQL; no ioBroker query adapter | yes (32-bit builds exist) | high JS rework, only candidate that runs today |
| InfluxDB 2.x | new client needed (aioinflux is v1-only) | Flux rewrite; Flux is deprecated by InfluxData | yes (64-bit pref.) | dead-end platform, double rework |
| TimescaleDB | full repo rewrite (SQL) | full JS rewrite | 64-bit pref. | most alive platform, highest cost |
| Stay 1.8 (contained) | — | — | runs today | default until the OS upgrade |

Context: InfluxDB 3 Core's original 72h query-range limit was lifted, and
InfluxDB 3 Enterprise (with the compactor for large historical ranges) is free
for non-commercial at-home use.

## Residual risks for migration day

- The ioBroker `influxdb` adapter officially supports only 1.x/2.x. Mitigation:
  it is itself a v1-API client (node-influx), the exact endpoints verified here;
  it does no state-logging in this setup (the `iobroker` database is empty) and
  only passes raw InfluxQL through `sendTo` — validate once during cutover, with
  VictoriaMetrics as the documented fallback.
- v1-compat auth headers differ in v3 (token-based); collectors get the token
  via env (config.py already supports credentials).

## Migration outline (the follow-up change, post-OS-upgrade)

1. Run InfluxDB 3 in docker alongside 1.8 (different port), with auth token.
2. Full export/import (line protocol, ~10 min at this size); count verification
   per measurement (tooling from this spike).
3. Switch collectors' .env and the ioBroker adapter host/port; verify all JS
   states update and the healthcheck stays green.
4. Keep 1.8 stopped-but-present for two weeks as rollback; then remove.
