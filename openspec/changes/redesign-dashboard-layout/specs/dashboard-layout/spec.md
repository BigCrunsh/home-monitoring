# dashboard-layout (delta)

## ADDED Requirements

### Requirement: Navigation is complete and consistent
Every navigation entry SHALL have a label and an icon consistent with the others.

#### Scenario: Weather nav icon
- **WHEN** the navigation bar is shown
- **THEN** the Weather entry has an icon like the other tabs (no blank button)

### Requirement: A shared visual system across views
The views SHALL share a consistent panel style, spacing, typographic scale, color
semantics, and de-DE number formatting.

#### Scenario: Cross-tab audit
- **WHEN** the tabs are compared
- **THEN** panels, fonts, spacing, and number formats are consistent rather than
  per-frame ad hoc

### Requirement: Each element earns its place and uses the best encoding
Every Main-view element SHALL be reviewed for value and encoding; misleading
snapshots SHALL become trends, and low-value tiles SHALL be removed or replaced.

#### Scenario: Element review
- **WHEN** the Main view is reviewed element by element
- **THEN** each is kept (best encoding), reworked (e.g. snapshot → sparkline), or
  removed, with the rationale recorded
