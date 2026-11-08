# monitoring-healthcheck (delta)

## ADDED Requirements

### Requirement: Grid import is reconciled with the utility meter daily
Once a day the healthcheck SHALL compare yesterday's grid import in the stored energy
totals with the utility meter's figure for the same day (from Tibber) and send one
Telegram alert when they differ by more than 5 % and more than 0.5 kWh.

#### Scenario: Meters agree
- **WHEN** the stored totals show 8.1 kWh and the utility meter 8.3 kWh
- **THEN** no alert is sent

#### Scenario: Large discrepancy
- **WHEN** the stored totals show 8.1 kWh and the utility meter 9.4 kWh
- **THEN** one alert names both figures, and it is not repeated for the same day

#### Scenario: A figure is missing
- **WHEN** either figure for yesterday is unavailable
- **THEN** no reconciliation alert is sent; the freshness checks cover missing data
