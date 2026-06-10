# dashboard-data-quality (delta)

## ADDED Requirements

### Requirement: Tiles distinguish live, stale, and unavailable data
Every priority tile (weather, energy, prices, heating) SHALL visually distinguish
live data, stale data (older than its source SLA), and unavailable sources.

#### Scenario: Stale source
- **WHEN** a tile's source state is older than its SLA (e.g. rain > 1 h)
- **THEN** the tile is visibly de-emphasized (grayed/⚠) and shows the data age

#### Scenario: Unavailable source
- **WHEN** a tile's source OID has no value (e.g. absent wind module)
- **THEN** the tile shows an explicit "offline/–" fallback — never `NaN` or a stale
  number presented as current

#### Scenario: Live source
- **WHEN** the source is within its SLA
- **THEN** the tile renders normally with no staleness decoration

### Requirement: Numbers use one locale and defined precision
All numeric tiles SHALL use de-DE formatting (comma decimal separator) with a defined
precision per quantity type.

#### Scenario: Electricity price
- **WHEN** the current price is 0.5163 €/kWh
- **THEN** it renders as `0,516 €/kWh` (3 decimals, comma separator) on every view

#### Scenario: Mixed-format regression
- **WHEN** the views are audited after the change
- **THEN** no tile uses a dot decimal separator or undefined precision

### Requirement: Alert colors meet WCAG AA contrast
State colors used on the dark theme SHALL meet WCAG AA contrast (≥ 4.5:1 for normal
text) against their background.

#### Scenario: Expensive-price highlight
- **WHEN** a value is highlighted as critical/expensive
- **THEN** the text color contrast against the panel background is ≥ 4.5:1
