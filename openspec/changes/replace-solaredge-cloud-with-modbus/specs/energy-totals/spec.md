# energy-totals (delta)

## ADDED Requirements

### Requirement: Energy per 15 minutes comes from meter counters
The system SHALL compute energy per 15-minute interval from the difference of lifetime
counters (inverter AC energy, grid-meter import, grid-meter export) and write it to
`electricity_energy_watthour` with the fields `Production`, `Purchased`, `FeedIn`,
`SelfConsumption` and `Consumption`.

#### Scenario: Normal interval
- **WHEN** all three counters have readings at both ends of an interval
- **THEN** `Production`, `Purchased` and `FeedIn` equal the counter differences,
  `Maxxisun = Maxxisun feed − Maxxisun charge`,
  `SelfConsumption = Production + Maxxisun feed − FeedIn` and
  `Consumption = Purchased + Production + Maxxisun feed − FeedIn − Maxxisun charge`

#### Scenario: Pi or network was down
- **WHEN** an interval has no counter reading at one of its ends
- **THEN** no point is written for it, and the next complete interval still carries
  the exact energy since the last reading

#### Scenario: Counter goes backwards
- **WHEN** a counter reading is lower than the previous one (meter reset or replaced)
- **THEN** that interval is skipped rather than written with negative energy
