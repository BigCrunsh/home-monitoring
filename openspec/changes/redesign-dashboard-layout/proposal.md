# Redesign dashboard layout & cross-tab consistency

## Why

The vis-2 dashboard has grown organically: each view/frame is laid out ad hoc
(186 absolutely-positioned widgets on Main alone), with inconsistent spacing,
panel styles, fonts, and number formats across tabs. The user wants a coherent
visual language and a smart-home/dataviz review of *what* each element shows and
*how*. Concrete entry points:

- **Bug**: the Weather nav button (`Navigation` w000551) has no icon assigned
  (`iImageFalse`/`iImageTrue` missing) while Main/Energy/Advanced do — quick win.
- **Main view**: element-by-element review — is each value shown in the best form?
  Are there snapshots that should be trends/sparklines? Outdated or low-value tiles
  to drop? More modern components (gauges, mini-charts, status chips)?
- **Cross-tab consistency**: shared panel style, spacing grid, typographic scale,
  de-DE number formatting, and the classic palette — applied uniformly so frames
  stop looking "organically grown."

This is the layout/IA/visual sibling of `improve-dashboard-data-states` (which
handles data-quality: staleness, NaN, formatting, contrast) — coordinate, don't
duplicate.

## What Changes

- Fix the missing Weather nav icon (assign a weather glyph consistent with the
  other nav buttons).
- Per-element review of the Main view → a prioritized rework (best encoding per
  metric; trends where a snapshot misleads; remove/replace low-value tiles;
  introduce modern components where they earn their place).
- Define and apply a **shared visual system**: panel container style, spacing
  grid, font scale, color/semantic palette, number/locale formatting — across
  Main, Energy, Advanced, Weather (+ the new panels).
- Reduce absolute-positioning fragility where feasible (grouped containers /
  reusable templates) so the layout is maintainable.

## Capabilities

### New Capabilities
- `dashboard-layout`: consistency + information-design requirements for the views.

### Modified Capabilities
- (none — coordinates with the data-quality requirements in monitoring/dashboard
  changes)

## Impact

- The vis-2 project (`integrations/iobroker/vis/main/vis-views.json`) across all
  views; deployed via the versioned vis tooling. Mockup-first per element/section,
  classic palette as ground truth, navigation container untouched in placement.
