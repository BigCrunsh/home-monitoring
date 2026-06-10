# energy-automation (delta)

## ADDED Requirements

### Requirement: Flexible loads run preferentially in cheap or PV-surplus hours
The system SHALL schedule the controlled load into hours that are cheap (below the
configured price threshold/percentile) or covered by PV surplus, within the load's
comfort constraints.

#### Scenario: Cheap hours ahead
- **WHEN** the price forecast contains hours below the cheap threshold within the
  load's allowed window
- **THEN** the load is enabled in those hours and disabled in expensive hours

#### Scenario: PV surplus available
- **WHEN** PV production exceeds house consumption by more than the load's power draw
- **THEN** the load may run regardless of price (surplus self-consumption)

#### Scenario: No cheap window before the deadline
- **WHEN** no hour below the threshold exists before the load's must-finish deadline
- **THEN** the load runs anyway in the least expensive feasible hours (comfort beats
  savings)

### Requirement: Manual override always wins
A household member SHALL be able to turn the controlled device on/off immediately,
overriding the automation until the next scheduling window.

#### Scenario: Manual on during expensive hour
- **WHEN** someone switches the device on manually
- **THEN** it runs immediately and the automation does not switch it off during that
  cycle

### Requirement: Automation decisions are observable
Every automated switch decision SHALL be visible (timestamp, reason: price/surplus/
deadline) and shifted consumption SHALL be measurable for savings review.

#### Scenario: Monthly review
- **WHEN** 30 days of automation have run
- **THEN** shifted kWh and estimated € saved vs. unshifted baseline can be computed
  from recorded data
