# Spacing & Alignment Concept — `.mv2` system (v2, 2026-07-02)

The single set of rules every view, card, and text block on the dashboard follows.
Rewritten for the `.mv2` HTML/CSS system (Figtree, foreignObject widgets); the v1 of this
document described the pre-rebuild vis-widget Main (RobotoCondensed, 386px/6px grid) and is
superseded. Tokens live in each script's `CSS_BASE` per `integrations/iobroker/DESIGN_SYSTEM.md`;
this file is the geometric contract. Measured ground truth: vis-views.json as of 2026-07-02.

## 1. View skeleton (the one grid)

Canvas 1178px wide; content spans **x = 4 … 1174** (4px outer margin both sides).

- **Hero band** (views with a hero): (4, 4) 1170×178.
- **Columns** start at **y = 189** (hero bottom 182 + 7px hero gap — deliberately tighter
  than the 12px gutter, owner-approved):
  - LEFT x 4…396 (392 wide — shares both edges with the nav)
  - MID x 408…785 (377 wide)
  - RIGHT x 797…1174 (377 wide)
  - **Column gutter = 12px** (396→408, 785→797), horizontal == vertical.
- **Nav** `(4, 688) 392×87` — never moves, identical object on every view.
- Widgets beside/below the nav (ribbon row): top 735 (12px gap above), bottom 775.
- LEFT column bottom 676 → 12px gap to the nav. MID/RIGHT may run to 723 (past the nav top).
- **Full-bleed views** (single grid widget, no hero): (4, 4) 1170×680; internal layout still
  follows §2. Bottom gap to nav = 4px (the widget's internal bottom padding supplies the
  optical 12px).

Measured drift to fix (2026-07-02):
- **Energy** is on the **legacy grid**: 3×386px columns at x4/396/788 with **6px gutters**,
  columns from y120. → Re-cut to the skeleton above.
- **Diagnose** uses the right column widths but **8px vertical gaps** (summary 76→84,
  columns 680→688). → Normalize to 12px gutters / 7px only under a hero band.

## 2. Spacing tokens — one value per role (4px grid)

| Role | Token | Value |
|------|-------|-------|
| Micro gap (icon↔text, stacked caption) | `--s1` | 4px |
| Small gap (within a component) | `--s2` | 8px |
| Card padding (text inset) | `--s3 --s4` | 12px vertical / 16px horizontal |
| Gap between cards/sections inside a widget | `--s3` | 12px |
| Section padding / large inset | `--s4` | 16px |
| Column gutter (H == V, between widgets) | — | 12px |
| Page margin | — | 4px |
| Hero → columns | — | 7px |

No pixel values off the 4px grid inside layout CSS; one-off nudges (5px, 9px, 17px…) are
drift unless they carry an explicit comment naming the optical reason.

## 3. Card padding & clearance — the anti-clipping rule

- **No text, number, or unit sits closer than 12px (`--s3`) to any card edge.**
- **Secondary / reference values right-align to that same 12px inset** — one consistent
  right edge per card.
- **Clearance over tight fit.** Never size text to within a few px of its box; size against
  the *longest possible* value (e.g. "-10,5", "100 %", "entriegelt", three-digit watts).
  Local captures render fonts slightly narrower than the wall tablet — a pixel-tight fit
  that looks clean in a screenshot clips on the device; margins absorb that.
- Rounded corners (r=14 cards, r=10 insets): content must clear the corner radius, not just
  the straight edge.

## 4. Alignment

- **Card internal order:** section header (top-left, muted caps) → content; metric rows =
  label left / value right, one shared baseline per row.
- **Equivalent data shares exactly one type role and one alignment** across all tabs — a
  room temperature, a last-update age, a €-value, a % value each look the same everywhere.
- **Metric pattern** (`.metric`): value carries the verdict colour; unit small, muted,
  top-aligned to the value cap; label small, muted, baseline-aligned. Inline `.u` units are
  the lightweight variant. One min/max arrangement wherever min/max appears.
- Numbers in columns/tables: `tabular-nums`, right-aligned on the decimal comma.

## 5. Type roles (from DESIGN_SYSTEM.md — one size per role)

`--t-clock:112 · --t-hero:88 · --t-metric:27 · --t-sub:18 · --t-label:14 · --t-cap:12`,
Figtree, display weight 600, body 500. A size not on this scale is drift unless the box
demonstrably cannot take the token size — then keep the working size **and note it** in the
script next to the rule. Never force a token size into a box where the longest value clips
(§3); never invent a new size silently.

## 6. Verification (non-negotiable)

After every deployed change: **force the wall tablet to reload** (a file write does not push
to connected vis clients) and confirm the change on the live screen — never report "fixed"
from a local capture alone (memory: `verify-before-claiming-fixed`). Tight fits get an
explicit device check. Local render harness (capture states → render → headless-Chrome
screenshot) is the review/measure tool, not the sign-off.

## 7. Cross-view consistency rules

Same concept ⇒ same rendering, on every tab:
1. **One font pipeline** — a single Figtree import (one weight set) and one `font-family`
   stack, shared by all six scripts; nav labels included (today the nav still renders
   RobotoCondensed 12px — align when the nav is next touched).
2. **Two text greys = the hierarchy.** Value = `--text` (or its verdict colour); label /
   caption / unit = the one muted grey. No per-tab grey variants.
3. **One section-header treatment** (size, caps, letter-spacing, divider) on every card.
4. **One staleness pattern** — "vor X min" + battery/quality icon, same position, same
   muting, same "–" for missing data, on every tile that shows a sensor value.
5. **Shared components are the only implementation** — spectrum bar, magnitude bar, Metric,
   tile, indicator dot. A tab needing a variant extends the component (new modifier class),
   never re-implements it.
