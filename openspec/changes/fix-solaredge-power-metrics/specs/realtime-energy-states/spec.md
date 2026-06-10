# realtime-energy-states (delta)

## ADDED Requirements

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
