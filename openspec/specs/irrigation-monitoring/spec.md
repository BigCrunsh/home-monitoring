# irrigation-monitoring Specification

## Purpose
TBD - created by archiving change revive-gardena-irrigation. Update Purpose after archive.
## Requirements
### Requirement: Irrigation data is captured continuously
The system SHALL capture the Gardena system's per-zone valve activity and sensor
readings (soil moisture, soil/ambient temperature, light, battery, RF link) into
InfluxDB via a single, supervised, always-on collector.

#### Scenario: Daemon runs supervised
- **WHEN** the Gardena collector is deployed
- **THEN** it runs as a restart-on-failure service (not cron) and `garden_*`
  measurements receive data while the Gardena cloud is reachable

#### Scenario: Single integration path
- **WHEN** the Gardena collector is active
- **THEN** the redundant ioBroker `smartgarden` adapter is disabled, so only one
  client polls the rate-limited Gardena account

#### Scenario: Cloud/auth failure
- **WHEN** the Gardena API rejects auth or is unreachable
- **THEN** the failure is logged with a structured error and the service retries
  rather than exiting silently

### Requirement: Irrigation freshness alerting is season-aware
Garden measurement freshness SHALL be monitored, but the off-season absence of
irrigation data SHALL NOT raise a failure alert.

#### Scenario: In-season stall
- **WHEN** irrigation is in season and garden data stops arriving past its SLA
- **THEN** a Telegram alert is raised

#### Scenario: Off-season
- **WHEN** irrigation is off-season
- **THEN** no staleness alert is raised and the dashboard shows an off-season state
  rather than an error

### Requirement: The dashboard answers the irrigation questions
The dashboard SHALL present, per zone, whether watering ran, whether soil moisture
is adequate, and whether the system is healthy.

#### Scenario: At-a-glance status
- **WHEN** a household member views the irrigation panel
- **THEN** each zone shows its last-watered time, current soil moisture (with a
  cheap/adequate/dry color band), and a health flag when battery/link is low

#### Scenario: Rain skip is explained
- **WHEN** watering was skipped because of recent/forecast rain
- **THEN** the panel shows the rain context rather than appearing to have failed

