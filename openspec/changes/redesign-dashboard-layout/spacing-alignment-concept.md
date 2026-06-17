# Spacing & Alignment Concept

The single set of rules every card/text/tile on the dashboard follows. Derived from
measuring the live Main view (so it fits what's there), it confirms the good bones and
fixes the drift. Tokens already live in `vis/main/vis-user.css`; this is the contract.

## 1. Grid (measured, kept)

- **3 columns × 386px**, left edges at **x = 4 / 396 / 788**.
- **Horizontal gutter = 6px** (`--space-sm`), **page margin = 4px** (`--space-xs`).
  `4 + 386 + 6 + 386 + 6 + 386 + 4 = 1178`.
- **Half-column** (inside a column): `190 + 6 + 190 = 386` — i.e. 190px halves with a 6px
  gutter. (Today they're 191 + 4px — normalize.)
- **Vertical gutter == horizontal gutter = 6px.** Stacked cards in a column share it.
  (Today vertical gaps drift 3–5px — normalize.)

## 2. Spacing tokens — one value per role

| Role | Token | Value |
|------|-------|-------|
| Gutter (H == V) | `--space-sm` | 6px |
| Page margin | `--space-xs` | 4px |
| Card padding (text inset) | `--panel-pad` | 12px |
| Tile pitch | `--tile-size` + `--space-md` | 66 + 9 = 75px |

## 3. Card padding & clearance — the anti-clipping rule

- **No text, number, or unit sits closer than the card padding (12px) to any card edge.**
  (The `€/l` clip was text at ~5px from a rounded corner.)
- **Secondary / reference values right-align to that same 12px inset** — one consistent
  right edge per card (e.g. the fuel max/min column).
- **Clearance over tight fit.** Never size text to within a few px of its box; size against
  the *longest possible* value. My screenshot tool renders the font narrower than the iPad,
  so a pixel-tight fit that looks clean in capture clips on the device — margins absorb that.

## 4. Alignment

- **Card internal order:** title (top-left) → metadata (last-update) → primary metric →
  secondary / reference.
- **Equivalent data shares exactly one font token and one alignment** across all cards.
- Labels and their values keep a fixed relationship (label dim/muted, value full weight).

## 5. Type scale

- The `--fs-*` scale applies **only where the box and its companion labels/icons
  demonstrably fit it** — verified, not assumed (the font-pass lesson). Where a box can't
  take the token size, keep the working size and note it; don't force the token.
- Convert leftover keyword sizes (`small`/`x-small`/`xx-large`) to px **only when the fit is
  verified** on the device.

## 6. Verification (non-negotiable)

After every block: deploy → screenshot → **confirm on the iPad**. Never report "fixed" from
the capture alone. Tight cases get an explicit device check.

## 6b. Presentation consistency (deep audit, 2026-06-17)

Same concept must look the same everywhere. The Main **vis widgets** are actually uniform
(RobotoCondensed-Regular, all `--color-font` #CCCCCC). The divergence is between those and the
**SVG-rendered cards** + a few HTML states:

| Aspect | vis widgets | SVG cards (Energiefluss/Maxxisun) | tankstelle HTML | → canonical |
|---|---|---|---|---|
| **Font** | RobotoCondensed | **Arial** | inherits Roboto | **RobotoCondensed everywhere** (kill Arial) |
| **Value colour** | #CCCCCC | **#fff** | #CCCCCC | `--color-font` **#CCCCCC** |
| **Label/muted colour** | #CCCCCC (no hierarchy!) | **#7f8a99 / #cfd6e0** | #8A8A8A | `--color-text-muted` **#8A8A8A** |

So one "muted label" role is rendered **four** different ways (#7f8a99, #cfd6e0, #8A8A8A, and an
undifferentiated #CCCCCC). And the **same concept is arranged differently** — min/max appears as:
hero (big value + small °C + "min" stacked), Tankpreis ("max 2,10⁹" muted-label prefix), Strompreis
(two bare values, no labels).

**Canonical rules:**
1. **One font** — RobotoCondensed-Regular, vis + SVG cards alike.
2. **Two text greys = a 2-tier hierarchy.** VALUE = `--color-font` #CCCCCC (or its data-ladder colour);
   LABEL / caption / unit / min-max prefix = `--color-text-muted` #8A8A8A. Nothing else. (Replaces
   #fff, #7f8a99, #cfd6e0 and the flat-#CCCCCC labels — labels should *recede*, values *pop*.)
3. **One min/max pattern** wherever it appears (hero, Strompreis, Tankpreis): muted `min`/`max` (or
   arrow) + value + muted unit, same arrangement.
4. Data-ladder colours (green/blue/amber/red) are the separate value-colour layer, unchanged.

**Applies first to the Energiefluss hub** (built RobotoCondensed + 2-tier greys from the start), then
retro-fitted to the existing Main blocks (hero min/max, Strompreis range, cost-breakdown labels,
last-update captions → muted).

## 7. Current drift — the 4.2 work list

1. **Gutters:** 6px (main) / 4px (half-col) / 7px (room sub-col) / 3–5px (vertical) → unify to 6px.
2. **Card padding:** ranges 12px … 0; enforce 12px inset everywhere + right-align reference values.
3. **Vertical rhythm:** card tops/heights ad hoc → align stacked cards to the 6px gutter.
4. **Keyword font sizes** still on many widgets → convert to px where the box fits (rule 5).
5. **Fuel price max/min** visual treatment (placeholder) → redesign here, not ad hoc.
