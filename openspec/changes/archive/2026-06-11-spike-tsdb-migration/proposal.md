# Spike: evaluate the InfluxDB 1.8 successor

## Why

InfluxDB 1.8 has been EOL since 2021 (no security patches) and InfluxQL is a dead-end
dialect. A migration touches every consumer, so the decision needs evidence, not
fashion. Decision (2026-06-10): evaluation spike first; the migration itself is a
separate follow-up change.

## What Changes

- Time-boxed evaluation (≤ 1 day) of: **VictoriaMetrics**, **InfluxDB 3**,
  **TimescaleDB**, and the null option (**stay on contained 1.8**).
- Evaluation against the *actual* constraints of this system, not generic benchmarks:
  - Python write path (`aioinflux` is InfluxDB-1.x-only — what replaces it?)
  - ioBroker `influxdb.0` adapter compatibility (used by `solaredge_power.js`,
    `tibber_states.js` queries)
  - InfluxQL queries embedded in the deployed JS scripts
  - Migration tooling for ~5 years of existing data
  - Resource fit on the Pi (or the decision to host the TSDB elsewhere, e.g. NAS)
  - Grafana datasource support
- Output: a decision document (`design.md` of this change) with a recommendation and a
  scoped follow-up migration change.

## Capabilities

### New Capabilities
- `timeseries-storage`: requirements any storage backend must satisfy (these outlive
  the spike and gate the migration).

### Modified Capabilities
- (none)

## Impact

- No production changes in this spike. A sample-data migration dry-run may run on a
  separate machine/container.
