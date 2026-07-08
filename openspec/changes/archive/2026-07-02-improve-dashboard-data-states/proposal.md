# Dashboard tiles distinguish live, stale, and unavailable data

> **ARCHIVED 2026-07-02 — superseded by the `.mv2` redesign + holistic review.**
> This change was scoped against the old vis-widget dashboard (per-tile age bindings,
> ~46 color bindings, wind/rain tiles), which no longer exists. Its surviving intent is
> folded into `redesign-dashboard-layout` as the **data-state honesty lens** of
> `holistic-review-2026-07.md`, and its open concerns trace to that change's task list:
> staleness/"–" pattern on every sensor tile (cross-tab rule), de-DE precision table,
> and the #A00629-contrast question (owner decision — palette hues are ground truth).
> Wind tile: already gone in the redesign. Gardena: kept (revived 2026-06-13).

## Why

The vis-2 dashboard renders failures as if they were live data: `NaN km/h` for a wind
module that doesn't exist, a rain value 5 months old, Autarkie 0% from lagged data.
Number formatting mixes German and English decimal conventions on one screen, and the
dark-red alert color (#A00629) fails WCAG AA contrast on the dark theme.

## What Changes

- Staleness handling on priority tiles: data-age bindings, gray-out/⚠ for stale,
  explicit "Sensor offline" fallback instead of NaN/blank.
- Remove tiles for sensors that don't exist (wind; garden pending the Gardena
  keep/retire decision).
- Locale-consistent number formatting (de-DE) with defined precision per quantity
  (€/kWh 3 decimals, °C 1 decimal, W integer, €/l 3 decimals).
- Replace #A00629 alert color with a WCAG-AA-compliant red; define the small color
  palette once and reuse.

## Capabilities

### New Capabilities
- `dashboard-data-quality`: presentation requirements for data state, formatting, and
  legibility.

### Modified Capabilities
- (none)

## Impact

- vis-2 project (`vis-2.0/main/vis-views.json`) — Main, Energy, Weather views; ~46
  color bindings; priority tiles get age bindings.
- Depends on `fix-solaredge-power-metrics` (publishes the data-age state) and the
  Gardena decision (open question in ROADMAP).
- vis project should be exported/backed up before editing (no version control for vis
  config yet — consider including the export in `version-iobroker-scripts` tooling).
