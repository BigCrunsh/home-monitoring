# Dashboard "Neu" — Design System

Reference for `main_v2.js` (the redesigned Main / "Neu" vis-2 tab). The card is built as scoped
HTML/CSS (everything under `.mv2`) wrapped in an `<svg><foreignObject>` so it scales-to-fill the
1170×676 widget. **Compose the dashboard from the components below — don't hand-place pixels.** When a
change is needed it should be "use component X", "bump a token", or "it's on the baseline" — not a
one-off nudge. (This file is the durable version of the design-system proposal agreed with the owner.)

## Principles

- **Verdict-led.** Every number carries a colour verdict; the value is coloured, units/labels stay muted.
- **Keep all info.** Add detail + icons; never silently drop a data source. Ask before removing.
- **Palette = ground truth.** Reuse the household's classic palette + thresholds; unify *meaning*
  (shared p20/p80 bands), never restyle hues. See the `dashboard-palette-is-ground-truth` memory.
- **Two reading distances.** A glance band (clock/weather/temp — read across the room) over instrument
  cards (read up close).
- **Pi reality.** No `color-mix()` (Pi Chromium may predate Chrome 111) → use the rgba tint tokens.
  Generic class names collide with vis-2 widget CSS → keep the `.mv2`/`m2*` prefixes.

## Tokens (`:root` on `.mv2`)

| Group | Tokens |
|---|---|
| Spacing (4px grid) | `--s1:4 --s2:8 --s3:12 --s4:16 --s5:20 --s6:24` |
| Radii (by nesting) | `--r2:14` (cards) · `--r3:10` (insets/tiles) |
| Type roles | `--t-clock:112 --t-hero:88 --t-metric:27 --t-sub:18 --t-label:14 --t-cap:12` |
| Symbol scale | `--sym-wx` (weather art) · `--sym-moon` (moon emoji) — bump these to resize hero glyphs |
| Inset | `--inset-x` — shared left/right page margin for hero content |
| Palette | `--green #b5fb5b` (favourable) · `--amber #F1BE3D` (normal) · `--red #A00629` (high/alert) · `--blue #5080AC` (info/cold) · muted greys |
| Tints | `--green-16 --amber-16 --red-16 --blue-16 --muted-16` (low-alpha fills/glows) |

Font = **Figtree** (Google Fonts), display weight **600** (not 700 — keeps it from reading "bold"),
body 500, captions/units muted. Numbers use `font-variant-numeric: tabular-nums` so live values don't jitter.

## Components

### 1. Metric — `tempMetric()` / `.metric`
A value with its unit and optional label, placed consistently:
- **value** (`.mval`) — carries the verdict colour, tight line-height.
- **unit** (`.mu .uu`) — small, muted, **top-aligned** to the value's cap (superscript: °C, %, mbar, kWh).
- **label** (`.mu .ll`) — small, muted, **bottom-aligned** to the baseline (min, max).

`.mu` is a `flex-column; justify-content:space-between` stretched to the value height → unit pins top,
label pins bottom. Used by: outside temp, forecast min/max, room temp. (Inline `.u` units — humidity %,
mbar, kW — are the lightweight variant where a superscript isn't needed.)

### 2. Hero — two tiers
`.hero` is a 3-column grid (`1fr auto 1fr`, `align-items:stretch`), each cluster a full-height column
with `justify-content:space-between`:
- **Top tier = display glyphs:** outside temp · weather symbol · clock · moon.
- **Bottom tier = one metadata baseline:** min/max · humidity · pressure · date · sun/moon rise-set.

Because every cluster fills the band height, all the bottom metadata lands on the **same baseline**
automatically. Equal top/bottom breathing room comes from the hero's symmetric vertical padding.
Layout L→R: temp(+min/max) · weather(+humidity/pressure) · clock(+date) · moon(+rise/set).

### 3. Room — `buildRoom()` / `.room`
A 4-row grid: **name** (primary) → **operational** (`.op`: last-update + battery) directly beneath →
**environmental** (`.env.hum` / `.env.co2`, stacked) on the left; the **temperature Metric** big on the
right. The round thermo icon spans rows 1–2 and top-aligns with the name. Comfort bands (the owner's:
≤3 grey / <12 blue / <20 green / <27 amber / ≥27 red) drive the icon tint + temp colour.

### 4. Indicator — `indDot()` / `.rind` (HAUS ribbon)
`dot · name (top) / status (beneath) · battery`. The battery (`lowbatIco()`, from each sensor's
`.0.LOW_BAT`) is **top-aligned with the name**, muted when ok / red + near-empty when low. (HmIP
operating-voltages aren't comparable across device types, so `LOW_BAT` is the canonical signal.)

### 5. Bars — two distinct concepts
- **Spectrum** (`.spectrum`) — a *position* on a green→amber→red gradient with a knob (price within its
  7-day p20/p80 band: Strompreis, Tanken). Verdict = where the knob sits.
- **Magnitude** (`.flow .track/.fill`) — a *quantity* bar filled proportionally and tinted by role
  (energy flows). `.fill` must be `display:block` for `width:%` to apply.

### 6. Cards / zones
`.card` = `--surface` fill, `--border`, `--r2`, no section headline (the content is self-evident). The
Energie card's frame colour tracks the net €/h rate (`energyFrame()`): green earning >0,05 · grey
break-even · amber normal cost · red when cost >0,05 **and** price ≥ p80.

## Geometry & deploy

Card widget at vis `(4,4)` 1170×676; nav at `(4,688)`; HAUS ribbon at `(404,688)`. Hero content +
zone cards share the inset so they line up with the nav (left) and the ribbon (right). Deploy +
screenshot-verify recipe and state-ID inventory: see
`openspec/changes/redesign-dashboard-layout/SESSION-HANDOFF.md`.
