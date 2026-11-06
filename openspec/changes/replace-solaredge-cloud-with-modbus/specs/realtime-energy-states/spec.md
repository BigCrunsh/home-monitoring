# realtime-energy-states (delta)

## REMOVED Requirements

### Requirement: Energy states derive from complete meter rows
**Reason**: the rows came from the SolarEdge cloud, retired on 2026-11-03.
**Migration**: production comes from Modbus; see the modified requirements below.

## MODIFIED Requirements

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
- **THEN** no new values are published and the states are marked stale

### Requirement: Whole-house balance anchors on the grid measurement
Consumption and autarky SHALL be computed from the grid anchor plus the live Modbus
production reading (`consumption = production + grid`,
`autarky = 1 − purchased / consumption`).

#### Scenario: Night with the inverter asleep
- **WHEN** the inverter does not answer Modbus and the sun is below the horizon
- **THEN** production counts as 0 W and consumption equals the live grid import

#### Scenario: Inverter unreachable in daylight
- **WHEN** the inverter does not answer Modbus while the sun is up
- **THEN** no new values are published and the states are marked stale

#### Scenario: Inconsistent inputs
- **WHEN** production combined with the live grid reading would yield negative
  consumption or self-consumption
- **THEN** values are clamped to physical bounds (≥ 0; self-consumption ≤ consumption)

### Requirement: The active calculation mode is observable
The script SHALL publish which mode produced the current values: `hybrid` (grid anchor
+ production) or `stale`.

#### Scenario: Mode transitions
- **WHEN** the Shelly state goes stale and later recovers
- **THEN** `power_calc_mode` transitions hybrid → stale → hybrid accordingly
