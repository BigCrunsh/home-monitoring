# Energiefluss — Main energy hub concept

Synthesis of three independent expert reviews (energy-optimization/smart-home · data-visualization ·
usability/wall-display). It replaces the four scattered energy cards (Strompreis, Stromkosten,
Autarkie, Eigenverbrauch) with one card in col 3 bottom (~386×280). **Review before build.**

## The job (3-second takeaway)
From across the room: **"Is the house running on free sun or buying expensive grid power — and is the
battery helping?"** One glance answers that; everything else is supporting detail.

## What all three experts agreed on
1. **Keep node-and-arrow** (sun → house ← grid, battery below) — the spatial metaphor is read
   pre-attentively. *Not* a Sankey (needs conserved totals, reads as a study-chart).
2. **The biggest upgrade = encode flow MAGNITUDE as arrow thickness** (sqrt-scaled, ~2px→14px) +
   direction by colour/animated dashes. The dominant flow then pops *before* you read a number.
   Hide flows < ~50 W.
3. **Cut the clutter.** Current card crams ~12 numbers; target ~5–6. Promote the flow numbers to
   `--fs-metric 36px`, demote the rest, honour the 13px floor.
4. **No emoji → `vis-icontwo` flat icons** (house/sun/grid/battery), recoloured by state (lime sun
   when producing, grey when dark). This is already a DESIGN_SYSTEM invariant.
5. **Make it actionable.** The one lever the user controls is the **Maxxisun relay** + the variable
   Tibber price → surface a cheap/expensive signal next to the toggle.
6. **Staleness:** grey the whole card + a small red dot if data is frozen (red = alarm only).

## Proposed layout (386×280)
```
┌────────────────────────────────────────────┐
│ ⌂ ENERGIEFLUSS         0,32 €/kWh           │  title + price
│                        cheap |──●──────| dear│  price-in-range track (lime→amber, marker=now)
│                                              │
│   ☀ PV            🏠 HAUS            ⚡ NETZ   │  vis-icontwo nodes, recoloured by state
│  1,8 kW ══════▶   0,9 kW   ·····   0 W       │  proportional arrows; HAUS = hero number
│                     │                        │
│                     ▼ lädt                   │
│                  🔋 Akku  0,9 kW             │  battery node (charge/discharge arrow)
│                                              │
│ Autarkie ███████░ 82%      +0,04 €/h   [ AN ]│  one bar + net €/h (signed) + relay toggle
└────────────────────────────────────────────┘
```
- **Top:** title left; current price + a **min→max "today" track** with a marker (so "cheap/dear" is
  *shown*, not asserted). Track lime→amber, never red.
- **Flow zone (the star, ~55% of height):** HAUS consumption centred and biggest; PV left, NETZ right,
  Akku below; arrows proportional + directional. Import arrow amber (not red — red is alarm only).
- **Bottom strip:** **one** Autarkie bar+%; **net €/h** signed (saving = lime, paying = amber); the
  **battery relay** as a `.tile-control` toggle (AN = filled amber, AUS = outline), in the corner away
  from the flow nodes, with a press-and-hold/confirm so a glance-tap can't flip the relay by accident.

## Where the experts diverged → my calls
- **Autarkie vs Eigenverbrauch:** energy + usability call Eigenverbrauch a vanity metric for a live
  display; dataviz would keep both small. **Call: keep one Autarkie bar; drop Eigenverbrauch from the
  hub** (it's a PV-efficiency stat → lives on the Energy tab).
- **Cost €/h:** usability wanted it gone; energy wanted a signed net headline. **Call: keep it, but as a
  small signed secondary number** (not the hero) — it's genuinely actionable.
- **Charge verdict badge:** energy expert wants an explicit "CHEAP — charge now" badge. **Call: the
  price-range track + colour does this job more cleanly; add a one-word state only if the track reads
  ambiguous in testing.**

## Data gap to flag
- **Battery state-of-charge (%) is NOT available** — the Maxxisun CCU2 integration is blocked, we only
  have signed battery *power* via the Shelly plug. So the hub can show charge/discharge **power +
  direction**, but not "battery 60% full." The charge signal is therefore price-driven (run loads / the
  relay when cheap), not SOC-aware. (See memory `maxxisun-ccu2-integration-blocked`.)

## Navigation icons (your follow-up)
The nav is persistent chrome — its icons should speak the **same `vis-icontwo` flat language** as the
new hub + control tiles, recoloured for the active tab. Proposed, more expressive set:
- **Main** → house (home) — keep, it's expressive.
- **Energy** → a **lightning bolt / plug-flow** glyph (currently a generic building) — make it
  unmistakably *energy*, echoing the Energiefluss hub.
- **Weather** → sun+cloud — already good (kept).
- **Advanced** → a **gauge / line-chart** glyph (it's the detail/diagnostics view).
Active tab = filled/accent; inactive = muted outline — one consistent treatment. Exact asset paths
mapped at implementation (small task, folds into the rollout). Nav container `w000547` never moves.
