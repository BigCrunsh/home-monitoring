# maxxisun-monitoring Specification

## Purpose
TBD - created by archiving change add-maxxisun-integration. Update Purpose after archive.
## Requirements
### Requirement: The second PV system's AC flow is metered
The system SHALL meter the Maxxisun's AC power at its socket, signed (negative =
feeding the house, positive = charging), and persist it to InfluxDB.

#### Scenario: Normal operation
- **WHEN** the Maxxi system feeds the house or charges
- **THEN** its signed power appears in InfluxDB within the collection interval

#### Scenario: Plug unreachable
- **WHEN** the metering plug stops reporting
- **THEN** the energy model counts the Maxxi as 0 W, and the freshness healthcheck
  flags the gap

### Requirement: The energy model includes both generators
Whole-house consumption and autarky SHALL include the Maxxisun output
(`consumption = SE_production + maxxi_output + grid`).

#### Scenario: Maxxi covers base load
- **WHEN** the Maxxi delivers 300 W while SolarEdge is dark and grid import is 0
- **THEN** consumption reads ~300 W and autarky 100%

