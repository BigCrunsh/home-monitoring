# Dashboard Design System

The shared visual language for the ioBroker vis-2 wall-tablet dashboard. Tokens live in
`vis/main/vis-user.css`; this doc is the rationale + the rules. Apply it consistently —
a `tools/lint_vis.py` check (see below) turns the rules into a checked contract.

## Governing principle — two-layer palette

vis **binding expressions cannot read CSS variables**. So colour has two layers:

1. **Static styling** (widget `style.color`, panel chrome) → use the CSS tokens below.
2. **Data-driven colour** (price/temperature/CO₂ ladders) → the publishing JS script owns a
   `PALETTE` constant (identical hex, single casing) and emits a companion **`*_sem` state**
   (`cold|good|warn|alarm|muted`) next to each value. Widgets bind the `*_sem` state instead of
   re-deriving p20/p50/p80 ladders inline. This collapses ~50 duplicated inline ladders into ~6
   script-owned classifiers — a threshold change becomes one line.

## Colour tokens

Primitives (in `vis-user.css`): `--color-red #A00629` · `--color-blue #5080AC` ·
`--color-yellow #F1BE3D` · `--color-green #b5fb5b` · `--color-panel #111217` ·
`--color-border #333333` · `--color-font #CCCCCC` · **new** `--color-text-muted #8A8A8A` ·
`--color-mute #7F8A99`.

Semantic tokens: `--sem-good` (lime — energy/PV/supply, cheap tier, saving) · `--sem-import` /
`--sem-cold` (blue — grid-import **and** cold; unified deliberately) · `--sem-warn` (amber — mid
DATA tier, *attention not alarm*) · `--sem-alarm` (red) · `--sem-muted` · `--acc-control` (amber —
UI control ON-state, a *distinct concept* from `--sem-warn`) · `--text` · `--text-on-bright`.

**Discipline:** one hue = one meaning. **Red = ALARM ONLY** (stale sensor `since>3600`, door OPEN,
lock UNLOCKED, top data tier). No static red on door labels or always-on forecast max-temps —
demote "expensive/hot" to `--sem-warn`. Lime = energy in *bars*; temperature may reuse lime only
inside a coloured *number*, never a filled bar.

## Type scale — one size per role

`--fs-hero 84px` (outside-temp + clock ONLY) · `--fs-metric 36px` (primary one-glance numbers:
room temps, Strompreis, Tankpreis, Autarkie W/%) · `--fs-sub 22px` (companions: min/max, humidity,
CO₂, Stromkosten, moon) · `--fs-label 16px` (names, captions, units, section titles) ·
`--fs-caption 13px` (**hard floor**: last-update, weekday, state strings — pair with
`--color-text-muted`, never go smaller). **No keyword sizes** (`small`/`x-small` are
non-deterministic on the kiosk). Equivalent data shares exactly one token.

## Icons

One canonical flat family: **`vis-icontwo`** for every control/nav/status glyph. `vis/signals`
reserved for trend arrows only. `daswetter` weather art kept as a documented forecast-only
exception. **No emoji in SVG cards** (use a JS concept→asset map → `vis-icontwo`). Every nav widget
**must** set both `iImageFalse` + `iImageTrue` (the Weather button bug: `w000551` → `nav_weather.png`).

## Spacing, grid & panel chrome

3 columns × `--grid-col 386px`, `--space-sm 6px` gutter (H == V), `--space-xs 4px` page margin;
tile grid on one pitch (`--tile-size 66px` + `--space-md 9px` = 75px, X == Y). Card chrome via
tokens + classes, not inline repeats: `--radius-card 12px`, `--radius-tile 8px`, `--panel-pad 12px`.
Three tile concepts: **`.card-metric`** (rounded panel, title + big number), **`.tile-control`**
(66px square, icon + caption, ON via `--acc-control`), **`.tile-toggle`** (45px square). The liked
green frame is **`.card--accent`** (1px lime border) — reused for the bigger Energiefluss card.

## Engineering / DDD

- Tokens defined once in `vis-user.css`.
- A shared `vis_card.js` (global script) exporting `cardChrome / semColor / arrow / label / kpiBar`
  + the FONT/COLOR tables, so the SVG-card renderers stop copy-pasting palette + chrome.
- Each publishing script owns its data-colour `PALETTE` + emits `*_sem` states (single source of truth).
- `tools/lint_vis.py` (in `check_drift`) flags: raw hex outside the token set, bare unitless lengths,
  off-scale font-sizes, nav widgets missing icon states.
- Keep each SVG `viewBox` == its widget px box so 1 unit = 1px and the font tokens render true.

## Invariants

Nav container `w000547` is ground-truth (never move/restyle). No pie/donut charts. **Restyle, never
silently drop information** — every value change to the layout is explicit and approved.
