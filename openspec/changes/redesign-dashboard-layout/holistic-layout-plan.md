# Holistic Layout Plan — Main view restructuring

Grounded in the measured layout (3 columns × 386px, 6px gutters, 4px margin). This is the
floor-plan to review **before** any panels move. Nothing executes until signed off.

## Current Main (what's where)

| Col | Top → bottom |
|-----|--------------|
| **1 (left, x4–390)** | Hero (weather) · 6-day forecast strip · **rooms + heating crammed together**: Wohnzimmer (left) with **Heizkreis/Warmwasser wedged below it**, Carlottas/Claras/Cleas stacked on the right sub-column |
| **2 (mid, x396–782)** | Clock/date · Calendar (tall) · Diesel + E5 (left half) + Moon (right half) |
| **3 (right, x788–1174)** | Control tiles (3 groups) · Strompreis + Stromkosten (side by side) · Autarkie + Eigenverbrauch bars |

**Problems:** col 1 bottom is the "organically grown" mess — 4 rooms are *not* uniform (one big
Wohnzimmer split from the other three) because the heating panel occupies the left sub-column. The
energy story is scattered across col 3 (price, cost, autarky bars) with the **Energiefluss diagram
not placed anywhere** (it's built on the shelf in `solaredge_power.js` → `energy_flow_card`).

## Proposed Main

| Col | Top → bottom |
|-----|--------------|
| **1 (left)** | Hero · forecast strip · **4 uniform room cards** (heating gone → clean room zone) |
| **2 (mid)** | Clock/date · Calendar · Diesel + E5 + Moon  *(unchanged — this column is already fine)* |
| **3 (right)** | Control tiles *(unchanged)* · **consolidated energy hub** (see decision below) |

### Moves
1. **Heizkreis + Warmwasser → Energy tab.** (You approved this — Pass 2.6.) Frees col 1's left sub-column.
   The Energy tab has empty space on its right (panels stop at x826) to receive it.
2. **4 rooms → uniform.** Two options to choose: **(A) 2×2 grid** in col 1 (compact, fills the width) or
   **(B) vertical list** of 4 full-width cards. I lean 2×2 — tidiest and leaves breathing room.
3. **Energy hub (col 3 bottom).** This is where the **Energiefluss diagram** gets addressed — see below.

## Energiefluss diagram — the key decision

It exists (`energy_flow_card`: PV/grid/house/battery flow + In/Out arrows + autarky + price) but was
never placed after the earlier tile attempt was reverted. Where it lands:

- **Option A — Energiefluss becomes the Main energy hub.** Replace today's separate Strompreis +
  Stromkosten + Autarkie + Eigenverbrauch (col 3 bottom) with one green-framed flow card. *Pro:* the
  whole energy story is one glanceable picture on Main. *Con:* biggest change to col 3; the flow card
  needs room to read well (it was cramped as a small tile before).
- **Option B — Energiefluss lives on the Energy tab; Main keeps the four cards (cleaned up).** *Pro:*
  low risk on Main, and a detailed flow diagram is a natural fit for the dedicated Energy view. *Con:*
  the flow isn't on the at-a-glance Main screen.

**My recommendation:** B for now (Energiefluss on the Energy tab, where the heating also goes — making
Energy the "full energy detail" view), keep Main's energy cards but tidy them. Revisit A once the
Energy tab is built and we can judge the flow card at full size. This de-risks Main.

## Decisions (confirmed 2026-06-17)
- **Rooms:** 2×2 grid.
- **Energiefluss:** **Option A — the Main hub** (replaces Strompreis/Stromkosten/Autarkie/Eigenverbrauch).
  Concept in `energiefluss-hub-concept.md` (approved).

## Phasing (each step: deploy → screenshot → confirm on iPad → next)

1. **Control-tile grid snap** (quick win) — uniform 5-col grid.
2. **Build the Energiefluss hub on Main** (Option A) per `energiefluss-hub-concept.md`.
3. **Energy-tab audit + concept** — review what's there → design what *should* be there: MORE detail than
   the hub, and at minimum everything removed from Main (Eigenverbrauch, the Heizkreis/Warmwasser heating,
   the €/h cost breakdown). Cleanly readable; a multi-perspective audit like the hub; a **consistent
   experience** Main-hub ↔ Energy-tab (same icon language, palette, type scale, flow metaphor).
   → present + pause for review.
4. **Execute the Energy-tab redesign** (move heating there; add Eigenverbrauch + cost detail + depth).
5. **2×2 rooms** on Main (col 1, freed by the heating move).
6. **Nav icons** + roll the concept to Weather/Advanced (Pass 3).
