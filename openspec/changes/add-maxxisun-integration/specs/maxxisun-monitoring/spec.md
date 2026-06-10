# maxxisun-monitoring (delta)

## ADDED Requirements

### Requirement: The second PV system is captured locally
The system SHALL capture Maxxisun production power, battery state of charge, and
battery charge/discharge power from the CCU2 via a local (non-cloud) interface and
persist them to InfluxDB.

#### Scenario: Normal operation
- **WHEN** the Maxxi system produces and the battery charges
- **THEN** production power, SoC, and charge power appear in InfluxDB within the
  collection interval

#### Scenario: CCU unreachable
- **WHEN** the CCU2 is offline
- **THEN** no stale values are written, and the freshness healthcheck flags the gap

### Requirement: The energy model includes both generators
Whole-house consumption and autarky SHALL include the Maxxisun output
(`consumption = SE_production + maxxi_output + grid`).

#### Scenario: Maxxi covers base load
- **WHEN** the Maxxi delivers 300 W while SolarEdge is dark and grid import is 0
- **THEN** consumption reads ~300 W and autarky 100% (today this reads 0 W / undefined)

### Requirement: Integration waits for an open CCU2 API
Implementation SHALL NOT scrape or reverse-engineer unstable interfaces; it waits for
the documented CCU2 local API (or a community adapter verified against CCU2).

#### Scenario: API still closed at re-check
- **WHEN** the periodic availability re-check finds the CCU2 API still unavailable
- **THEN** the change remains pending and the re-check date is updated in tasks
