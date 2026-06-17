# Energy Tab — Audit & Concept

The Energy tab is the **drill-down behind the Main Energiefluss hub**. Every number the
hub summarises gets its detail here, plus the data moved off Main (heating) and the
self-sufficiency view. Same design language as the hub: one font (RobotoCondensed),
2-tier greys (`--color-font` #CCCCCC value / `--color-text-muted` #888 label), magnitude
bars, red→green price spectrum, 3×386 grid (x = 4 / 396 / 788).

## 1. Audit — what's on the tab today (36 widgets)

| Panel | Data | Verdict |
|---|---|---|
| **Strompreis-Vorschau** (forecast chart, full width) | `tibber_states.price_forecast_chart` | **Keep — the star.** Hourly 48h curve, green/red 7-day quantile bands, "now" line. This *is* the detail behind the hub's single spectrum marker. |
| **ENERGIEFLUSS card** (mid-left, 255px) | autark/eigenverbrauch — renders broken (Autarkie 1 %, 983 W, bad bars) | **Remove.** Stale duplicate of the old pre-hub card; mislabeled and broken. |
| **3-phase power** (Shelly 3EM, mid-right) | Wirk/Schein/Strom × 3 phases | **Keep + restyle.** Genuine detail — the hub shows only *net* grid; this shows per-phase active/apparent/current (load balance). |
| **Strompreis + Stromkosten** (bottom cards) | tibber price + Einkauf/Gewinn/Gespart €/h | **Keep + restyle.** The economics breakdown is unique detail; current-price value is redundant with the chart + hub. |
| **Nav** (bottom-left container) | Navigation view | Keep. |
| **Right half + bottom-left** | — | **Empty / wasted** — content stops at x≈826 of a ~1300 canvas. |

## 2. Gaps — what must be added

- **Heating** (moved off Main, user-approved): Heizkreis (Vorlauf/Rücklauf + Ventil %),
  Warmwasser (Speicher/Rücklauf + Ventil %), Außentemperatur. The dominant household
  energy load — belongs in the energy detail view, absent today.
  - *Data note:* in June the circuit is idle (Heizkreis valve 0 %, WW 6 %); Vorlauf (28°)
    reads below Rücklauf (52°) — consistent with an idle circuit, but worth confirming the
    flow/return sensor labels aren't swapped.
- **Autarkie / Eigenverbrauch** done properly — replacing the broken duplicate card.

## 3. Concept — each hub number, drilled down

| Main hub says… | Energy tab shows the detail |
|---|---|
| Strompreis 0,40 · teuer | **Forecast chart** — when is it cheap *today*? |
| Netzbezug 9 W | **Per-phase power** — which phase, Wirk/Schein/Strom |
| +0,00 €/h | **Stromkosten** — Einkauf / Gewinn / Gespart €/h, + €/Tag |
| Autarkie ≈ 100 % | **Autarkie & Eigenverbrauch** panel (proper, with context) |
| *(not on hub)* | **Heizung** — Heizkreis, Warmwasser, Außentemperatur |

## 4. Layout — 1 + 3 + 3 on the Main grid

```
┌──────────────────────────────────────────────────────────────┐
│  STROMPREIS-VORSCHAU            jetzt 0,40 €/kWh · teuer        │ row1  full width
│  ▁▂▃▅█ hourly bars · green=günstig red=teuer · │now            │ (chart, keep)
├────────────────────┬────────────────────┬─────────────────────┤
│ LIVE-LEISTUNG      │ STROMKOSTEN        │ AUTARKIE & EIGENVERBR.│ row2
│ (Shelly 3EM)       │ jetzt   0,40 €/kWh │ Autarkie    ▓▓▓░ 62 % │
│ Wirk    -8 W       │ Einkauf  0,12 €/h  │ Eigenverbr. ▓▓░░ 41 % │
│  P1 56  P2 -104 P3 │ Gewinn   0,03 €/h  │                       │
│ Schein 701 VA …    │ Gespart  0,08 €/h  │ (7-day context line)  │
│ Strom  2,9 A …     │ ──────────────     │                       │
│                    │ heute   +1,20 €    │                       │
├────────────────────┼────────────────────┼─────────────────────┤
│ HEIZKREIS          │ WARMWASSER         │ AUSSENTEMPERATUR      │ row3
│ Vorlauf   28 °C    │ Speicher  56 °C    │        15 °C          │ (moved from Main)
│ Rücklauf  52 °C    │ Rücklauf  59 °C    │  Ventile: HK 0 %      │
│ Ventil     0 %     │ Ventil     6 %     │           WW 6 %      │
├────────────────────┴────────────────────┴─────────────────────┤
│ [ Main ] [ Energy ] [ Weather ] [ Advanced ]      (nav)        │
└────────────────────────────────────────────────────────────────┘
```

## 5. Expert lenses

- **Energy:** the actionable drill-down — forecast (shift loads to green hours), per-phase
  (3-phase balance), economics (€/h → €/day), self-consumption efficiency, and heating (the
  biggest load, with Vorlauf/Rücklauf spread as the efficiency signal).
- **Smart-home:** consistent with the hub's language; the forecast is the one screen that
  changes behaviour (when to run the dishwasher / charge).
- **Visualisation:** one grid, 2-tier greys, magnitude bars; remove the broken duplicate; no
  number repeated verbatim from the hub — only its *detail*.
- **Usability:** scannable top→bottom; answers "the detail behind the hub" in one glance.

## 6. Decisions (approved 2026-06-17)

1. **Layout 1 + 3 + 3 — approved** as drawn.
2. **Stromkosten: add €/Tag** (running daily total) alongside €/h. *(Data source TBD — verify.)*
3. **Autarkie/Eigenverbrauch: add a 7-day context line** as well as the current values.
4. Confirm heating flow/return labels (Vorlauf < Rücklauf on an idle circuit) — open data flag.
