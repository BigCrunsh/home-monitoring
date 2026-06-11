# Tasks

## 1. Constraints inventory

- [x] 1.1 Consumer inventory: aioinflux (v1 API: query + line-protocol write) in
      repositories/influxdb.py; ~10 InfluxQL queries in deployed JS scripts incl.
      PERCENTILE-over-subquery and last(*) GROUP BY tag; ioBroker influxdb adapter
      = v1 client used only as query passthrough (no state-logging configured —
      the `iobroker` database is empty); future Grafana (InfluxQL datasource)
- [x] 1.2 Measured: 42 MB data, 74 series, ~300k points/month. Plus the decisive
      platform fact: the Pi is 32-bit armv7 — no modern TSDB runs on it, so any
      migration sequences AFTER upgrade-pi-os

## 2. Candidate evaluation

- [x] 2.1 VictoriaMetrics: write path trivial, but no InfluxQL → ~10 JS query
      rewrites + no ioBroker query path; only candidate with armv7 builds
- [x] 2.2 InfluxDB 3: WINNER — v1-compat endpoints carry the entire existing
      surface (verified, see 3.1); 72h-Core-limit lifted upstream; Enterprise
      free for at-home use; needs 64-bit OS
- [x] 2.3 TimescaleDB: most alive platform, highest cost (full SQL rewrite both
      sides) — not justified for 42 MB
- [x] 2.4 Null option: contained 1.8 (localhost-bound) is the explicit default
      until upgrade-pi-os lands

## 3. Dry run & decision

- [x] 3.1 Dry-run on real data: 415,218 points (30d, all 26 measurements) imported
      into influxdb:3-core via the v1-compat /write — zero errors, all counts
      match; production InfluxQL queries verified on /query; aioinflux verified
      unchanged (read + write)
- [x] 3.2 Decision recorded in design.md: InfluxDB 3 after upgrade-pi-os;
      migration outline + residual risks (adapter validation at cutover,
      VictoriaMetrics as fallback) documented
