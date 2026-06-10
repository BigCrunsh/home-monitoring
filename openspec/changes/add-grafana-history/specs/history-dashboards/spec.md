# history-dashboards (delta)

## ADDED Requirements

### Requirement: Historical views over selectable time ranges
The system SHALL provide authenticated dashboards for energy, price-vs-consumption,
heating-vs-outdoor-temperature, and base-load history with user-selectable time ranges.

#### Scenario: Energy week view
- **WHEN** a user opens the energy dashboard with a 7-day range
- **THEN** production, consumption, self-consumption, and autarky are plotted from
  InfluxDB history

#### Scenario: Unauthenticated access
- **WHEN** a client opens Grafana without logging in
- **THEN** access is denied (anonymous read-only access only if explicitly configured
  and documented)

### Requirement: Dashboards are provisioned from the repository
Grafana datasources and dashboards SHALL be defined as files in this repo and
provisioned into the container, so a container rebuild reproduces them exactly.

#### Scenario: Container recreated
- **WHEN** the Grafana container is removed and recreated from the documented command
- **THEN** all dashboards and the datasource are present without manual clicks

#### Scenario: Dashboard edited in the UI only
- **WHEN** a dashboard is changed in the UI without exporting to the repo
- **THEN** the documented workflow flags that the change must be exported to the
  provisioning files to survive a rebuild
