# energy-totals (delta)

## ADDED Requirements

### Requirement: Energy per 15 minutes comes from local meters
The system SHALL compute energy per 15-minute interval from the difference of the
inverter's lifetime AC energy counter and from the grid meter's energy for the interval
netted across the three phases (as the utility meter bills it, not per phase), and
write it to `electricity_energy_watthour` with the fields `Production`, `Purchased`,
`FeedIn`, `Maxxisun`, `SelfConsumption` and `Consumption`.

#### Scenario: Normal interval
- **WHEN** the inverter counter has readings at both ends and the grid meter a record
  for the interval
- **THEN** `Production` equals the counter difference, `Purchased` and `FeedIn` the
  positive and negative part of the phase-netted grid energy,
  `Maxxisun = Maxxisun feed − Maxxisun charge`,
  `SelfConsumption = Production + Maxxisun feed − FeedIn` and
  `Consumption = Purchased + Production + Maxxisun feed − FeedIn − Maxxisun charge`

#### Scenario: One phase exports while another imports
- **WHEN** phase A exports 200 Wh while phase C imports 300 Wh in an interval
- **THEN** `Purchased` is 100 Wh net, not 300 Wh, and `FeedIn` is 0

#### Scenario: Pi or network was down
- **WHEN** an interval has no inverter counter reading at one of its ends
- **THEN** no point is written for it, and the next complete interval still carries
  the exact production since the last reading; the grid meter keeps its own records

#### Scenario: Counter goes backwards
- **WHEN** a counter reading is lower than the previous one (meter reset or replaced)
- **THEN** that interval is skipped rather than written with negative energy
