# monitoring-healthcheck (delta)

## ADDED Requirements

### Requirement: Stale measurements trigger an alert
The system SHALL alert via Telegram when a measurement's newest data point is older
than its configured freshness SLA.

#### Scenario: Sensor dies
- **WHEN** `weather_rain_mm` has no data point newer than its SLA at check time
- **THEN** a Telegram message naming the measurement and the age of the last data point
  is sent within one check interval (1 h)

#### Scenario: Recovery notice
- **WHEN** a measurement that was alerted as stale receives new data
- **THEN** a recovery message is sent once

#### Scenario: InfluxDB unreachable
- **WHEN** the healthcheck cannot query InfluxDB
- **THEN** it alerts about the monitoring failure itself rather than reporting nothing

### Requirement: Alerts are deduplicated
The system SHALL NOT repeat an unchanged staleness alert more than once per 24 hours
per measurement.

#### Scenario: Persistently dead sensor
- **WHEN** a measurement remains stale across many hourly checks
- **THEN** at most one reminder per 24 h is sent for it

### Requirement: Freshness SLAs are configuration
Per-measurement SLAs SHALL be defined in configuration (not hard-coded), with a
documented default for unlisted measurements.

#### Scenario: New measurement appears
- **WHEN** a measurement exists in InfluxDB but has no SLA entry
- **THEN** the default SLA applies and the healthcheck does not crash
