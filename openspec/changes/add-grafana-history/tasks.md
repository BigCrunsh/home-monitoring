# Tasks

## 1. Provisioning

- [ ] 1.1 Check Pi headroom (RAM/CPU) for a Grafana container; pick image/tag
- [ ] 1.2 `conf/grafana/`: datasource (InfluxDB 1.8, InfluxQL) + dashboard provisioning
      config in the repo; docker run/compose snippet in README/Makefile
- [ ] 1.3 Admin credentials via env (not committed); verify login required

## 2. Dashboards (as code)

- [ ] 2.1 Energy day/week: production/consumption/self-consumption + autarky stat
- [ ] 2.2 Price vs consumption: hourly price overlay with hourly kWh; consumption-
      weighted vs unweighted average price stat
- [ ] 2.3 Heating: flow/return/storage temps vs outdoor temp (dual axis), valve signal
- [ ] 2.4 Base load: nightly minimum consumption trend (failing-appliance detector)

## 3. Integration

- [ ] 3.1 Link Grafana from the vis-2 navigation view
- [ ] 3.2 Rebuild test: remove container, recreate, confirm dashboards reappear
- [ ] 3.3 README: access URL, credential handling, export-to-repo workflow for UI edits
