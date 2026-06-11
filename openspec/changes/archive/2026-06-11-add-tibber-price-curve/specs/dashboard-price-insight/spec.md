# dashboard-price-insight (delta)

## ADDED Requirements

### Requirement: Hourly price curve with current-hour context
The Main view SHALL display the hourly electricity price for at least the next 12 hours
(up to 36 when tomorrow's prices are published), color-banded by relative price level,
with the current hour visually marked.

#### Scenario: Tomorrow's prices arrive
- **WHEN** Tibber publishes the next day's prices (~13:00)
- **THEN** the curve extends to include tomorrow within one refresh cycle

#### Scenario: Forecast unavailable
- **WHEN** the price forecast cannot be fetched
- **THEN** the chart shows the current price plus an explicit "no forecast" state, not
  an empty or frozen chart

#### Scenario: Cheap-hour recognition
- **WHEN** a family member glances at the chart
- **THEN** hours below the cheap threshold (p20) are visually distinct (e.g. green
  band) from expensive hours (p80+)
