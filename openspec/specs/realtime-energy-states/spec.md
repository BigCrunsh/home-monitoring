# realtime-energy-states Specification

## Purpose
TBD - created by archiving change fix-solaredge-power-metrics. Update Purpose after archive.
## Requirements
### Requirement: Energy states derive from complete meter rows
Real-time energy states SHALL be computed from the newest InfluxDB row in which
consumption-side meter fields are present — not from the newest row overall. This
covers consumption, production, feed-in, purchased, self-consumption, and the autarky
and self-consumption rates.

#### Scenario: Newest row is inside the consumption lag window
- **WHEN** the newest `electricity_power_watt` row has `Consumption = 0` and
  `SelfConsumption = 0` while older rows within 6 h have complete data
- **THEN** states are computed from the newest complete row and `rate_autarky` reflects
  actual self-sufficiency

#### Scenario: No complete row available
- **WHEN** no row within 6 h has consumption-side data
- **THEN** the states are marked stale (data-age state) instead of publishing zeros

#### Scenario: Physically impossible row
- **WHEN** a candidate row has `FeedIn > Production`
- **THEN** it is treated as incomplete and skipped

### Requirement: Published states carry their data age
The script SHALL publish the timestamp/age of the row used, so consumers can
distinguish a live value from a lagged one.

#### Scenario: Dashboard reads the age state
- **WHEN** the states are updated from a row 2 h old
- **THEN** the published age state reports ~2 h, enabling a staleness indicator

### Requirement: Grid exchange derives from the grid-point meter in near real time
Purchased and feed-in power SHALL derive from the live grid-point meter (Shelly 3EM)
when its data is fresh, making them exact for the whole house regardless of how many
generation systems exist.

#### Scenario: Live grid data available
- **WHEN** the Shelly grid state is younger than 5 minutes
- **THEN** `power_purchased = max(0, grid)` and `power_feedin = max(0, −grid)` update
  within one computation cycle of the live reading

#### Scenario: Grid meter stale
- **WHEN** the Shelly grid state is older than 5 minutes
- **THEN** the script falls back to the newest-complete-SolarEdge-row mode and the
  calculation mode state reflects the fallback

### Requirement: Whole-house balance anchors on the grid measurement
Consumption and autarky SHALL be computed from the grid anchor plus the freshest
available production reading (`consumption = production + grid`,
`autarky = 1 − purchased / consumption`), without waiting for lagged consumption-meter
fields.

#### Scenario: Sunny midday with export
- **WHEN** production exceeds house load and the Shelly shows export
- **THEN** autarky reads 100% (purchased = 0) within the production input's freshness
  (~1 h via the SolarEdge cloud; live once Modbus TCP replaces the term), not 2 h later

#### Scenario: Night
- **WHEN** production is 0
- **THEN** consumption equals the live grid import exactly and autarky reads 0 without
  division-by-zero artifacts

#### Scenario: Inconsistent inputs
- **WHEN** stale-high production combined with the live grid reading would yield
  negative consumption or self-consumption
- **THEN** values are clamped to physical bounds (≥ 0; self-consumption ≤ consumption)

### Requirement: The active calculation mode is observable
The script SHALL publish which mode produced the current values: `hybrid` (grid anchor
+ production), `solaredge` (complete-row fallback), or `stale`.

#### Scenario: Mode transitions
- **WHEN** the Shelly state goes stale and later recovers
- **THEN** `power_calc_mode` transitions hybrid → solaredge → hybrid accordingly

