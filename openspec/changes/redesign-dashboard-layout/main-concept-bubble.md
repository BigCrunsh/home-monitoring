# Main Dashboard Concept — "Bubble" aesthetic, verdict-led

Grounded in a pedantic visual audit of the live board (2026-06-19) and the owner's stated
use (kitchen, active use, read closely; only time + outdoor temp read from across the room).

## 1. The one idea: answer questions, don't show data

The board today *displays numbers*. A professional dashboard *answers the owner's recurring
questions*. Three items are really **verdicts**, not values:

- **CO₂ → "lüften?"** — a green/yellow/red light, not a ppm number.
- **Temperature → "comfortable?"** — per room, a comfort light (too cold to play / too warm to
  sleep / too warm). Numbers stay, but the colour carries the answer.
- **Fuel (diesel) → "tanken jetzt?"** — günstig/teuer verdict, not just a price.
- **Energy → "Waschmaschine jetzt?"** — a run-high-loads signal, not just watts.

## 2. Hierarchy — two reading distances (the backbone)

- **Glance band (top, full width):** big **time** + big **outdoor temp** (+ weather word + next
  calendar event). The only things read from across the kitchen — so they are the largest,
  highest-contrast elements, nothing else competes.
- **Zone grid (below):** everything read up close, grouped by the decision it serves.

## 3. Aesthetic — Bubble Card (owner's pick)

- Dark background (kept). Rounded **"bubble" rows/buttons**: pill-shaped, generous padding,
  leading icon · label · value/state.
- **Status via the icon colour + a subtle fill tint**, never a whole-card flood. One accent per
  state. Colour = meaning only (reuse the energy palette: grey neutral / green good / yellow
  normal-cost / red high or alert).
- **Detail via pop-up / the zone's tab** — Main never scrolls; it's the summary. Tap a bubble → depth.
- **Bottom nav** (the Bubble signature) — the tabs as shortcuts along the bottom.
- Reconcile the **two colour systems**: today the control tiles (blue/amber/green/red by device
  type) clash with the energy semantics. Move controls to a state convention: **on = bright
  accent, off = muted**; reserve red for genuine alerts (door open, etc.).

## 4. Zones (functional grouping → 1:1 with the tabs)

| Zone | On Main (the verdict) | Drill-down tab |
|---|---|---|
| **Klima** | Außen now→later · per-room temp-comfort + CO₂ lights | 6-day forecast, per-room history, lüften detail |
| **Heute** | calendar: today + must-remembers, next days | full calendar |
| **Energie** | status + price verdict + "Waschmaschine jetzt?" + flow | per-phase, costs, autarky, heating *(built)* |
| **Tanken** | Diesel verdict (günstig/teuer) + price; E5 secondary | price history |
| **Steuerung** | frequent shortcuts (Tür, Rollläden, TV, Drucker, Plugs) + light status + scenes | all devices by room |
| **FYI** | Moon (small, kept — owner likes it) | — |

## 5. Grid (fixes the "no shared grid" finding)

Strict modular grid: uniform bubble heights, one gutter value (6px), aligned baselines across
all columns, consistent card padding (12px). The current board's columns are independent stacks
that don't line up — this is the biggest driver of the "unprofessional" feel.

## 6. Climate verdict logic (owner-requested)

Each room bubble: **name · temp (number + comfort colour) · CO₂ light**.

- **CO₂ (lüften):** green < 1000 · yellow 1000–1400 · red ≥ 1400 ppm *(tune)*.
- **Temp comfort:** blue (too cold) · green (comfortable) · amber/red (too warm) — but the bands
  are **room-purpose-specific** (a play room: too cold matters; a bedroom: too warm to sleep
  matters). **OPEN:** which rooms are sleep vs play vs living, and the °C bands. Default proposal:
  comfortable 19–23 °C · too cold < 18 · too warm > 24; bedrooms flag > 22 as "warm zum Schlafen".

## 7. Decisions captured
- Aesthetic = **Bubble Card**.
- Maxxisun **charge**: yellow ≤ 500 W, **red > 500 W** (small battery — its own scale). *(done)*

## 7b. Authentic Bubble styling — reproducible token extraction

We can't run Bubble Card (Home-Assistant-only), so we **recreate its look in SVG** — but from
its *real* tokens, not by eye. Reproducible procedure:

1. `git clone --depth 1 https://github.com/Clooos/Bubble-Card /tmp/bubble-card` — **pin the
   commit** (currently `612aaaa`) so the result is repeatable.
2. `grep -rn "var(--bubble-" /tmp/bubble-card/src/**/styles.css` — read the `var(--token, DEFAULT)`
   fallbacks (the defaults are the authoritative design tokens).
3. Map each default to a named constant in `main_v2.js` (with a source comment), e.g.:
   - `--bubble-border-radius: 32px` → `CARD_RAD`
   - button row `border-radius: calc(var(--row-height,56px)/2)` → **rows are pills**: radius = `h/2`
   - `--bubble-icon-border-radius: 50%` → circular icon disc
   - `--bubble-icon-size: 24px` → `ICON_SZ`
4. On a Bubble Card update, bump the pinned commit, re-grep, update the constants. The styling
   stays faithful and the derivation is auditable — no eyeballing.

## 8. Open questions before building
1. Confirm the **priority model** (§2) and zone set (§4).
2. **Comfort bands** per room (§6) — your numbers, or approve the defaults.
3. Layout: 3-column grid (kept) vs a rethink — see the sketch presented in chat.
4. Build order: which zone to mock up first (recommend **Klima** — richest verdict logic).
