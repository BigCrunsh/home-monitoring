# Tasks

Refreshed 2026-07-02 to match shipped reality and carry the holistic-review results.
Finding IDs (B/X/U/E/K/S/D/M/OD) refer to `holistic-review-2026-07.md`; measured facts
to `consistency-matrix-2026-07.md`; the geometric contract is
`spacing-alignment-concept.md` (v2). Evidence renders: `review-2026-07/*.png`.

## 1. Design system (DONE)
- [x] 1.1 Multi-expert audit of the live Main; define tokens + concepts
- [x] 1.2 Captured in `integrations/iobroker/DESIGN_SYSTEM.md` (superseded the early
      vis-user.css approach; committed ef6c777, rebuilt as `.mv2` HTML/CSS 2026-06-22)

## 2. Restyle Main (DONE — superseded by the Main2/"Neu" HTML/CSS rebuild)
- [x] 2.x The old per-widget restyle plan (vis_card.js helper, `*_sem` states, keyword-size
      sweep) was overtaken: Main was rebuilt as HTML/CSS `main_v2.js` on the Main2 view,
      column-split (45f7604), and promoted to the canonical **Main** view. Heating panels
      moved to the Energy tab (2.6) as part of that.

## 3. Tab roll-out (DONE — all six tabs live on `.mv2`-style HTML/CSS)
- [x] 3.0 Nav renamed (Übersicht · Energie · Klima · Diagnose · Steuerung · Musik) +
      custom SVG icons
- [x] 3.1 Energy tab (`energy_tab_v2.js`)
- [x] 3.2 Climate tab (`klima_v2.js`, replaced the 51-widget Weather view)
- [x] 3.3 Control tab (`steuerung_v2.js`, tap-tested on the wall)
- [x] 3.4 Diagnostics tab (`diagnose_v2.js`)
- [x] 3.5 Old Main removed; views renamed canonical (Main = redesigned overview)
- [x] 3.6 Musik tab (`musik_v2.js`, Sonos via jishi node-sonos-http-api)

## 4. Spacing & alignment audit (DONE → results feed §5–§12)
- [x] 4.1 Written spacing/alignment concept for `.mv2` (`spacing-alignment-concept.md` v2,
      2026-07-02 — grid, tokens, anti-clipping, type roles, cross-view rules)
- [x] 4.2 Full audit of every view executed as the four-lens **holistic review 2026-07**
      (spacing edge-scan + consistency matrix + dataviz + smart-home UX) on live wall
      state. Findings → `holistic-review-2026-07.md`; work items below.
- [x] 4.3 Verification discipline documented (concept §6) — applies to every task below:
      deploy → force wall-tablet reload → confirm on-device; never sign off from a local
      capture alone.

---

Execution order for §5–§11: **§5.1 first** (the shared layer makes every other fix a
one-place change), then per-tab re-cuts (worst first: Energie → Steuerung/Musik →
Diagnose), then per-tab polish. Each pass: build → deploy → wall verify → owner look.
OD items (§12) that gate a task are noted inline.

## 5. System-wide unification (the "one system" work)
- [ ] 5.1 **Shared CSS/token + component layer** (X1): one source (shared literal or
      build-time include) for tokens, Metric, spectrum, magnitude bar, tile, room card,
      indicator/battery icons, `agoStr()`/formatters; the six scripts keep only layout +
      data wiring. Kill the `.et2` namespace; all SVG wrappers get viewBox scaling like
      main_v2.
- [ ] 5.2 **Canonical token values** (X2, X12; gated by OD2): one value per token across
      all tabs (--t-hero, --t-clock, --t-label/cap, --r3, spacing set); update
      DESIGN_SYSTEM.md to match the blessed values; Musik/Steuerung adopt tokens.
- [ ] 5.3 **One verdict table** (X4; gated by OD4): single implementation for Strompreis,
      net €/h, Autarkie, Eigenverbrauch, Hausverbrauch, production, valve-running; kill
      the per-tab threshold forks (matrix §8 has every file:line).
- [x] 5.4 ~~One alarm red~~ — **dropped per OD1** (2026-07-04): both reds stay exactly
      where they are today; no color changes.
- [ ] 5.5 **One unit/number formatter** (X6, X8): shared Metric/`.u` rendering (superscript
      rule, space rule, W↔kW adaptive under 1 kW, signed grid direction with
      Bezug/Einspeisung wording, de-DE everywhere); sweep "5w", "0,33€/kWh", "50%",
      "1,2GB".
- [ ] 5.6 **One staleness grammar + escalation** (X7): shared `agoStr()` ("vor X min/h/d",
      "jetzt"), one age→colour escalation rule (muted → amber → red), reserved "–" slot
      for missing values (B5), rule for red-vs-muted "–" (Diagnose exception explicit).
- [ ] 5.7 **Spectrum + magnitude component unification** (X9; OD5 for direction): one
      spectrum (with knob-clamp inside the track, muted end labels, optional Ø-tick) and
      one magnitude bar (one height, fixed scales per quantity — OD7).
- [ ] 5.8 **Section-header grammar** (X10; gated by OD3): apply the blessed `.card-h` spec
      on detail tabs; overview stays headline-free.
- [ ] 5.9 **Fix B1 weather icons** (gated by OD6): `wxImg()` & friends →
      `Wetter_Symbol_id2` + chosen 19-icon gallery on Main hero, Klima hero, hourly tiles,
      6-day rows; wall-verify each slot.

## 6. Übersicht
- [ ] 6.1 Label the card header "0,00€/h" as "jetzt" (U4). ~~Fixed bar scale~~ dropped
      per OD7 — current normalization stays.
- [ ] 6.2 Ribbon: status word under name, offline (UNREACH) visually distinct from secure,
      battery icons only when relevant if space demands (U2) — wall-verify with a real
      offline contact
- [ ] 6.3 E5/Diesel: one band logic for value colour + knob (U3)
- [ ] 6.4 Domain-verdict chips for lights ("3 Lichter an"), music, Warmwasser (U5 —
      additive)
- [ ] 6.5 Rename "TV" scene tile → "Fernsehabend" or visually mark scene tiles as actions
      (U6)
- [ ] 6.6 Calendar: size card to its rows (57px dead bottom), fix truncation strategy for
      kids' events, stray space in "Wertstoffe ( 👷…" (U7)
- [ ] 6.7 Fix Diesel/E5 label clearance (B3) and Wohnzimmer battery slot (B5)

## 7. Energie
- [ ] 7.1 Re-cut to the `.mv2` skeleton (E1/B4: 392/377/377 @ 12px, y189 columns, 12px nav
      gap, one text inset)
- [ ] 7.2 LIVE-LEISTUNG: split PV / Akku / Netz / Haus, adaptive W/kW, close the 210px
      dead band (E2/E3); SoC row when a data path exists (Maxxisun CCU2 still blocked —
      until then labeled ≈ estimate). ~~Fixed bar scale~~ dropped per OD7.
- [ ] 7.3 Price chart: fixed 48 h axis or honest dynamic title, right-end time label,
      min/max € anchors, unit on pill + callout (E4); repeat günstig-window as a
      STROMKOSTEN chip (E5)
- [ ] 7.4 VERLAUF: like-for-like period comparison (or uncoloured until comparable);
      **verify `cost_this_day` compute** (0,33 € @ 0,2 kWh — standing charge or bug;
      check tibber_states.js + the Pi-timezone day boundary) (E6)
- [ ] 7.5 HEIZUNG: verify sensor mapping against the boiler (Vorlauf 38,4 < Rücklauf 55,0
      @ Ventil 0%; hotwater_return ≡ storage 59,3); dim temps at Ventil 0%; band at least
      Speicher (E7)
- [ ] 7.6 AUTARKIE/EIGENVERBRAUCH: Ø-7-Tage tick on track, muted end labels, knob clamp
      (E8; direction per OD5)

## 8. Klima
- [ ] 8.1 Fix soil-card clipping (B2) + list rows onto the shared row component (K1)
- [ ] 8.2 Dead-sensor escalation: age label coloured past threshold, row dimmed,
      "offline · Batterie leer" (K2; uses 5.6)
- [ ] 8.3 Sparklines: shared y-domain across room cards (verify current autoscale
      behaviour first) or drop when flat; hero 24h curve wider + min/max anchors + time
      ticks (K3)
- [ ] 8.4 Hero min/max: same Metric treatment as Main (verdict colours, °C format) (K4/U8)
- [ ] 8.5 Forecast: "heute" marker or start at Fr after ~18:00; clarify/verify
      trend-arrow conditionality (K5)
- [ ] 8.6 Valve list: WATERING + remaining time when running; surface stale-valve anomaly
      ("vor 32 d") (K6)
- [ ] 8.7 6-day bars: one muted reference tick through all rows (K7 — small)

## 9. Steuerung
- [ ] 9.1 Frame re-cut: 4px margin, 12px section gaps, 12px internal padding (S1)
- [ ] 9.2 Rollläden: direction word/glyph for "100 %", empty value on "Alle", unify
      "100 %"/"50%" spacing (S2)
- [ ] 9.3 "Maxxi Akku" → "lädt: X W" labeling (unidirectional plug) (S3); verify plugs
      show live W when on
- [ ] 9.4 Garten: "tippen = 10 min" once in the section header; tiles show
      state/countdown after tap (verify `duration_leftover_i` renders); "Garten Stop"
      dimmed when idle (S4)
- [ ] 9.5 Add Ambiente to LICHTER (S5 — additive)

## 10. Diagnose
- [ ] 10.1 Device/battery fleet card (HmIP LOW_BAT+UNREACH, Netatmo modules, Gardena
       sensors) + device-death folded into the banner verdict (D1/X11)
- [ ] 10.2 SYSTEM·PI: top-align rows on one gap token; RAM/Disk with capacity ("von X GB"
       or % + bar like CPU); unify unit treatment in-card (D2)
- [ ] 10.3 Row gaps → shared token; frame gaps 8→12 (D3)
- [ ] 10.4 Explain "geplant"; label Netatmo age as "neuestes Modul" (D4)

## 11. Musik
- [ ] 11.1 Frame re-cut to 4/12/12 + adopt tokens (M1)
- [ ] 11.2 Offline row fully dimmed + "offline"; ghost/disabled play slot on TV rooms with
       reason (M2)
- [ ] 11.3 GRUPPEN: active-preset marking (tile-on pattern), verify icon-colour semantics
       (M3)
- [ ] 11.4 Volume magnitude bar (or "/100"), green "spielt" state, now-playing line per
       room (M4)

## 12. Owner decisions (decided 2026-07-04 via the visual decision page; OD6 open)
- [x] 12.1 OD1: **colors stay unchanged** — both reds remain exactly where they are today
       (no consolidation, no re-coloring). "Two alarm reds" (X5) closed as accepted → task
       5.4 dropped.
- [x] 12.2 OD2: **bless the wall** — hero 98 / clock 126 become the documented tokens;
       --r3 = 10 canonical; caption floor 12px. DESIGN_SYSTEM.md to be updated (5.2).
- [x] 12.3 OD3: **14px + underline** on all detail tabs; overview stays headline-free.
- [x] 12.4 OD4: **verdict table approved as proposed** (Strompreis banded everywhere;
       Eigenverbrauch green; Autarkie ≥75/≥40/muted floor; Hausverbrauch amber ~1,5 kW,
       red ~3 kW; Erzeugung green ≥75 W; Bewässerung läuft = green; Übersicht net-€/h
       rule everywhere; "an/aktiv" = amber tint frame, full amber reserved for verdicts).
- [x] 12.5 OD5: **rule confirmed** — axis = value low→high, colors follow that value's
       verdict; write into DESIGN_SYSTEM.md, unify the component (5.7).
- [ ] 12.6 OD6: daswetter gallery style — full 19-icon comparison of galeria2/3/4
       delivered on the decision page; awaiting the pick.
- [x] 12.7 OD7: **keep the current bar normalization** (relative to the largest current
       flow) — owner accepted deliberately; no fixed scale. U1/E2 scale sub-items dropped.

**MUST-KEEP (restyle only, never silently drop):** outside-temp hero, room temps + trend
arrows, Strompreis, Stromkosten (Einkauf/Gewinn/Gespart), Autarkie, Tankpreise, multi-day
forecast, calendar, all controls, the Energiefluss flow, Musik room controls. Nav
container never moves.
