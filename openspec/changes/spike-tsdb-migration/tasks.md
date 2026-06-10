# Tasks

## 1. Constraints inventory

- [ ] 1.1 List every InfluxDB consumer with its exact interface: aioinflux calls in
      `repositories/influxdb.py`, InfluxQL strings in deployed JS scripts, ioBroker
      `influxdb.0` adapter version/capabilities, planned Grafana datasource
- [ ] 1.2 Measure current DB size, cardinality, write rate (for sizing)

## 2. Candidate evaluation

- [ ] 2.1 VictoriaMetrics: line-protocol ingest path, query path for the ioBroker
      scripts (no InfluxQL — what breaks?), Pi/NAS resource fit
- [ ] 2.2 InfluxDB 3 (or 2.x): client library path, adapter support, migration tooling
- [ ] 2.3 TimescaleDB: write client, query rewrite cost, ops burden on Pi
- [ ] 2.4 Null option: contained 1.8 (localhost-bound, after harden-network-services) —
      residual risk statement

## 3. Dry run & decision

- [ ] 3.1 Export 1 month of all measurements; import into the front-runner; verify
      counts and spot values
- [ ] 3.2 Write design.md: comparison matrix, recommendation, follow-up change scope
