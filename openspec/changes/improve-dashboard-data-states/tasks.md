# Tasks

## 1. Preparation

- [ ] 1.1 Export/back up the vis-2 project before editing
- [ ] 1.2 Inventory priority tiles and their source OIDs + SLAs (reuse the healthcheck
      SLA table)
- [ ] 1.3 Resolve the Gardena decision (keep → re-auth; retire → remove tiles/adapter)

## 2. Data-state handling

- [ ] 2.1 Build the staleness pattern once (age binding + CSS class) on one tile;
      validate on the tablet
- [ ] 2.2 Apply to priority tiles (weather block, energy block, prices, heating)
- [ ] 2.3 Replace dead tiles: wind (module absent) → remove or "offline" card; rain →
      staleness-aware (hardware fix is a separate chore)

## 3. Formatting & color

- [ ] 3.1 Define precision table per quantity; apply de-DE formatting on all numeric
      tiles (Main, Energy, Weather)
- [ ] 3.2 Replace #A00629 with an AA-compliant red; centralize the palette in the
      project CSS; sweep all ~46 color bindings
- [ ] 3.3 Visual regression pass on the tablet (screenshot before/after, compare)
