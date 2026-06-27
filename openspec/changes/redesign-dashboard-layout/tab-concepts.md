# Tab Concepts — All Views (2026-06-27)

Final tab structure: **Overview · Energy · Climate · Control · Diagnostics**
Nav labels updated and deployed. Old Main kept as backup until Control tab covers all its functionality.

---

## Overview (Main2 — already built)

HTML/CSS foreignObject pattern. Left/mid/right columns + hero. DONE.
Open: Steuerung tap-overlays need wall verification.

---

## Energy (replaces current Energy view + current Advanced)

**Purpose:** Full energy drill-down. "Where is power coming from, what does it cost, is the heating running?"

**Layout: 1 + 3 + 3** (approved 2026-06-17 in energy-tab-concept.md — preserved)

```
┌────────────── PREIS-VORSCHAU 48h chart (full width) ──────────────────┐
├──────────────────┬──────────────────┬──────────────────────────────────┤
│ LIVE-LEISTUNG    │ KOSTEN           │ AUTARKIE                         │
│ SolarEdge PV kW  │ jetzt  X,XX €/h  │ ████░ 72%  spectrum              │
│ Grid ± kW        │ Einkauf / Gewinn  │ 7-day context bar                │
│ Shelly 3-phase   │ ──────────────── │                                  │
│ L1 / L2 / L3    │ VERLAUF          │ HEIZUNG                          │
│                  │ Std    X,XX €    │ Vorlauf   °C  spectrum bar       │
│                  │ Heute  X,XX €    │ Rücklauf  °C  spectrum bar       │
│                  │ Monat XX,XX €    │ Ventil    %                      │
│                  │ Jahr   XXX  €    │ Warmwasser °C spectrum bar       │
└──────────────────┴──────────────────┴──────────────────────────────────┘
```

**New vs. existing energy_tab.js:**
- Keep: et_power_card (Shelly 3EM), et_costs_card, et_autarky_card, et_heizkreis_card, et_warmwasser_card, et_outdoor_card
- Add: cost VERLAUF table (from current Advanced tplEnergyCard widgets — 6 periods: last/this hr/day/mo/yr)
- Add: SolarEdge Modbus live production + grid in LIVE-LEISTUNG panel
- Restyle: full HTML/CSS design system (currently old SVG-card style)
- Advanced view widgets (w000796–w000827) superseded by VERLAUF table → can be removed

**Data sources added:**
- `javascript.0.solaredge_modbus_production` (live PV W)
- `javascript.0.solaredge_modbus_grid` (live grid W, signed)
- `javascript.0.tibber_states.cost_this_hour/day/month/year`
- `javascript.0.tibber_states.cost_last_hour/day/month/year`

---

## Climate (replaces current Weather view)

**Purpose:** "What's the air quality in each room, what's outside, and what's happening with irrigation?"

**Room → module mapping (confirmed from old Main labels):**
- Wohnzimmer       → base station `70-ee-50-32-c3-4c` (temp + humidity + CO₂ + pressure)
- Carlottas Zimmer → `03-00-00-0e-16-36` (temp + humidity + CO₂)
- Claras Zimmer    → `03-00-00-0f-01-6e` (temp + humidity + CO₂)
- Cleas Zimmer     → `03-00-00-10-e5-42` (temp + humidity + CO₂)

**Confirmed 2026-06-27 (live CO₂ check):** main_v2.js mapping is correct; old Main labels were swapped.
- `03-00-00-0e-16-36` = Carlottas Zimmer (~860 ppm)
- `03-00-00-0f-01-6e` = Claras Zimmer (~770 ppm)
- `03-00-00-10-e5-42` = Cleas Zimmer (~930 ppm)

```
┌── HERO ──────────────────────────────────────────────────────────────┐
│  14.2°C  ⛅  heute min 9° max 18°  │  🌧 0.8mm  │  1030 hPa ↗      │
├──────────────┬──────────────┬──────────────┬───────────────────────── ┤
│ AUSSEN       │ WOHNZIMMER   │ CARLOTTAS    │ CLARAS / CLEAS           │
│ Temp range   │ 27.7°C       │ 26.9°C       │ 26.9°C  /  28.1°C        │
│ spectrum bar │ 54% rH       │ 54% rH       │ 53%     /  47%           │
│ Humidity bar │ CO₂ ██░░     │ CO₂ ████░    │ CO₂ ██░░ /  CO₂ ████    │
│ Rain today   │ 827 ppm      │ 843 ppm      │ 766 ppm  /  933 ppm      │
├──────────────┴──────────────┴──────────────┴─────────────────────────┤
│ GARDENA — BEWÄSSERUNG                                        [■ Stop] │
│ Left 2/3: valve list                │ Right 1/3: soil sensors        │
│  Randbeet       CLOSED  12.Jun 05:09 [▶] │  Gemüsebeet  50%  12°C   │
│  Vorgarten      CLOSED  12.Jun 03:14 [▶] │  Hochbeet    55%   7°C   │
│  Traufkies.     CLOSED  12.Jun 03:49 [▶] │  Dachterr.    0%   9°C   │
│  Dachterrasse   CLOSED  31.Mai 14:40 [▶] │                           │
│  Garten         CLOSED  12.Jun 03:34 [▶] │                           │
│  Hochbeet       CLOSED  12.Jun 04:09 [▶] │                           │
└─────────────────────────────────────────────────────────────────────-┘
```

CO₂ spectrum: green ≤1000 / amber 1000–1400 / red ≥1400 ppm (same thresholds as main_v2.js)
Humidity spectrum: green 40–60%, amber outside
Outdoor temp spectrum: today min→max bar, marker at current
Pressure: value + trend arrow from `PressureTrend` (stable/up/down)

**Gardena data (iobroker.smartgarden already installed, confirmed 2026-06-27):**

Soil sensors (`SERVICE_SENSOR_*.soilHumidity_value` + `soilTemperature_value`):
- `747c45b4` = "Gemüsebeet" — soilHumidity, soilTemperature only
- `c080e523` = "Hochbeet" — soilHumidity, soilTemperature, ambientTemperature, lightIntensity
- `daa34269` = "Dachterrasse" — soilHumidity, soilTemperature, ambientTemperature, lightIntensity

Valve controller `b193e1f6` = "Bewässerung" — 6 valves:
- `:3A1` = "Randbeet", `:3A2` = "Vorgarten", `:3A3` = "Traufkiesstreifen"
- `:3A4` = "Dachterrasse", `:3A5` = "Garten", `:3A6` = "Hochbeet"
- Per valve: `activity_value` (CLOSED/WATERING/PAUSED), `activity_timestamp` (last change), `duration_leftover_i` (seconds remaining)
- Control: `duration_value` (writable, seconds to water) → triggers start; `stop_all_valves_i` on valve set stops all

Valve rows: show name + activity badge (green=WATERING, muted=CLOSED) + "last ran" time from `activity_timestamp` + [▶] start button (writes 600 to `duration_value`)
Soil sensor cards: name + humidity% (spectrum green 30–70%) + soil temp °C
[■ Stop] button writes to `stop_all_valves_i`

**Replaces:** existing Weather view (51 absolute-positioned old-style widgets)
**Reuses:** `spectrum()`, `priceSuper()`, design tokens, Figtree font — same pattern as main_v2.js

---

## Control (new view — replaces Alt slot in nav, currently points to old Main)

**Purpose:** Full device control surface — everything that didn't fit in Overview's 6-tile Steuerung.

**From old Main right column (reference: old_main_reference.png):**

```
┌── LICHTER ────────────────────────────────────────────────────────────┐
│  Eingang    Küche    Esstisch   Couchtisch   Ambiente                 │
│  Flur       Büro     Keller     Spielzimmer  TV-Bereich               │
│  Clara (Decke)   Carlotta (Decke)   Carlotta (Stehlampe)             │
├── ROLLLÄDEN ──────────────────────────────────────────────────────────┤
│  Alle ↑↓        Shutter A  ↑↓        Shutter B  ↑↓                  │
├── PLUGS ──────────────────────────────────────────────────────────────┤
│  Couch    Drucker    Maxxisun    Stehlampe    Vitrine                 │
│  (with live W reading per plug)                                       │
└───────────────────────────────────────────────────────────────────────┘
```

Door/lock controls (Verriegeln/Entriegelt/Öffnen) are covered by Overview's Tür tile — no need to duplicate.
Alarm/security status (red tiles in old Main) → Review: are these the ribbon sensors? If so, ribbon in Overview already covers them.

**Style:** same i-vis-universal tile approach as Overview Steuerung, OR HTML/CSS tiles like Overview right column.
Decision needed: native vis tiles (simpler, proven) vs. HTML/CSS (consistent with new design system).

---

## Diagnostics (replaces current Advanced view content)

**Purpose:** "Is everything healthy? When did each source last update?"

```
┌── ADAPTER STATUS ──────────────────────────────────────────────────── ┐
│  ● netatmo  ok  5m    ● tibber   ok  2m    ● solaredge ok  8s        │
│  ● shelly   ok  3s    ● influxdb ok        ● javascript ok           │
├── SYSTEM (Pi) ──────────────────┬── DATEN-AKTUALITÄT ─────────────── ┤
│  CPU   12%  spectrum bar        │  SolarEdge  live    8s             │
│  RAM   38%  spectrum bar        │  Tibber     price   2m             │
│  Uptime  14d                    │  Netatmo    poll    5m             │
│                                 │  Shelly     MQTT    3s             │
└─────────────────────────────────┴────────────────────────────────────┘
```

No hero row needed — functional view.

---

## Implementation Order

1. **Energy** — most data already exists in energy_tab.js; restyle + add VERLAUF table + SolarEdge modbus
2. **Climate** — new HTML/CSS tab; confirm room↔module mapping first
3. **Control** — new view; decide native tiles vs. HTML/CSS; then remove old Main
4. **Diagnostics** — after Advanced cost cards confirmed moved to Energy

---

## Decisions (2026-06-27)

1. **Room mapping:** main_v2.js is correct. 0e-16-36=Carlotta, 0f-01-6e=Clara, 10-e5-42=Clea. ✓
2. **Gardena:** `iobroker.smartgarden` is already installed and live. 4 devices confirmed 2026-06-27:
   3 soil sensors (Gemüsebeet, Hochbeet, Dachterrasse) + 1 valve controller (Bewässerung) with 6 named valves.
   Climate tab Gardena section: valve list with last-ran time + start buttons; soil sensor humidity/temp cards.
3. **Control tile style:** HTML/CSS unified design system (same pattern as main_v2.js). ✓
4. **Old Main removal:** after Control tab wall-verified.
