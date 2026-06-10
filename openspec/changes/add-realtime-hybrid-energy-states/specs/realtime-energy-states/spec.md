# realtime-energy-states (delta)

## ADDED Requirements

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
