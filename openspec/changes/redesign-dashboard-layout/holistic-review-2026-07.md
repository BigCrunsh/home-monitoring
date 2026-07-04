# Holistic Dashboard Review — 2026-07-02

**Method.** Live wall state captured from the Pi (20 published HTML states, deployed
sources verified == repo, vis-views.json), re-rendered locally at exact vis geometry,
screenshotted per tab (evidence: `review-2026-07/*.png`). Four independent lenses:
static CSS/token consistency matrix, spacing/alignment audit (edge-scan measured),
data-visualization expert, smart-home UX (incl. the data-state-honesty lens folded in
from the archived `improve-dashboard-data-states` change). Constraints respected:
palette hues + thresholds are ground truth, color rule A is final, nav never moves,
no data source dropped.

**Core diagnosis.** The owner's perception is measurably correct: *one design system,
seven hand-copied implementations.* Every script carries its own `CSS_BASE` copy and the
copies have drifted — token values, namespaces (`.et2` on Energie), component shapes,
verdict thresholds, unit typography, staleness grammar, and even the view grid differ per
tab. Only Übersicht and Klima sit on the documented skeleton. Nothing here needs a
redesign; it needs **unification onto the components that already exist**.

Findings carry IDs (`X`=cross-tab, `U/E/K/S/D/M`=per tab, `B`=confirmed bug,
`OD`=owner decision). The task list in `tasks.md` references these IDs.

*Correction 2026-07-04:* the first-pass evidence renders showed wind arrows in the
weather-symbol slots — a harness artifact, not a dashboard bug (see the B1 retraction).
The `review-2026-07/*.png` renders were regenerated with the correct icons.

---

## Confirmed live bugs (B)

- **B1 — RETRACTED (2026-07-04). Weather symbols were never broken.** The review's local
  renders fetched daswetter icons with a loose path match
  (`find … -path "*galeria1/6.png" | head -1`) that hit the adapter's **viento-wind**
  (wind-arrow) family instead of **tiempo-weather** — both ship a `galeria1`. So the
  rendered heroes/forecast tiles showed arrows the wall never displayed; owner confirmed
  the wall shows correct weather art, and `tiempo-weather/galeria1/6.png` is verified to
  be a proper condition icon. `Wetter_Symbol_id` + `tiempo-weather/galeria1` is a correct
  pairing — **no change needed**. Every arrow-derived finding dies with this (incl. the
  "pressure rising vs fallend contradiction" two lenses reported). Evidence renders
  regenerated with the correct icons. Lesson: harness assets must be fetched from the
  exact serving path, and the owner's eyes on the wall are ground truth.
- **B2 — Klima soil-sensor card clips its last row.** Rows 46px/14px gaps; "Dachterrasse"
  needs y724, card ends y723 → 0px bottom padding, corner radii cut through the row.
- **B3 — Main Diesel/E5 scale labels 4px from the card bottom** (top inset 11px) —
  on-device clipping risk (local renders are ~4px optimistic vs the tablet).
- **B4 — Energie view touches the nav** (columns end y688 = nav top; skeleton wants 676+12)
  — part of the legacy-grid re-cut (E1).
- **B5 — Wohnzimmer room tile drops the battery slot** instead of rendering the reserved
  "–" (the other three rooms keep it) — breaks the shared staleness pattern.

## Cross-tab findings (X) — why it doesn't feel like one system

1. **X1 — Seven copied CSS blocks, zero shared source.** Each script (plus Main's ribbon)
   hand-copies `CSS_BASE`; Energie even uses its own `.et2` namespace. Every other X
   finding is a symptom. Remedy: one shared CSS/token+component source injected into every
   script (build step or shared literal), scripts keep only layout + data wiring.
2. **X2 — Token values diverge.** `--t-hero` = 98 (Ü/K) / 30 (E) / 48-unused (D) vs DS 88;
   `--t-clock` 126 vs DS 112; Energie redefines `--t-label/cap` to 15/13 (rest 14/12);
   `--r3` = 12 on Steuerung/Musik vs 10 elsewhere; spacing-token subsets differ per tab;
   Musik has **no** tokens (all px literals). → OD2 decides canonical values, then one
   token block everywhere.
3. **X3 — View grids differ** (spacing audit): card/section gap 12 ✓Ü/✓K, 6H/8V (E),
   8 (S), 8 (D), 10 (M); page margin 8px on S/M vs 4px; nav clearance 12/12/**0**/12/8/8.
   Three re-cuts (E, S+M frames, D gaps) unify the wall.
4. **X4 — Same quantity, different verdict.** Strompreis p20/p80-coloured (Ü) vs always
   muted (E); net €/h red gated on price≥p80 (Ü) vs flat ≥0,30 (E); Autarkie ≥75 green +
   muted floor (Ü) vs ≥80 + red floor (E); Eigenverbrauch **blue** (Ü) vs **green** (E);
   Hausverbrauch amber at 150W (Ü) vs 3000W (E); production green at ≥75W (Ü) vs ≥200W
   (E); valve "läuft" green (K) vs blue (S). → one verdict table (OD4), one implementation.
5. **X5 — Two alarm reds.** Token `--red #A00629` vs off-palette `#d8536f` (ribbon dots,
   Tür-arm). Combined with the archived change's finding that #A00629 fails WCAG-AA on
   dark: one owner decision (OD1) settles both.
6. **X6 — Unit micro-typography has four dialects.** Superscript `.uu` + tight no-space
   `.u` (Ü) / inline with leading space (E) / tight without Metric (K, D) / raw value-sized
   text " W", " %" (S); plus "5w" lowercase, "0,33€/kWh" no-space vs "0,33 €/kWh",
   "100 %" vs "50%", "1,2GB" vs "112 d". One Metric/`.u` component ends all of it.
7. **X7 — Three staleness grammars** ("vor 34 s/X min" Ü · "jetzt/X min/X d" K · bare
   "34 s" D) and **no escalation rule** (a room card aging to 3 h would stay muted grey).
   Also missing-data "–" is muted everywhere but red on Diagnose (intentional? make it a
   rule). One `agoStr()` + one threshold-to-colour rule.
8. **X8 — Units/aggregation switch per tab for the same live flows.** "306 w" (Ü) vs
   "0,3 kW" (E); SolarEdge+Maxxisun split (Ü) vs summed "Erzeugung" (E); grid "5 w"
   unsigned (Ü) vs "Netz · Einspeisung 0,0" (E) vs "Σ −6 W" (E, Shelly table) — three
   framings of one connection. Rule: adaptive unit (<1 kW ⇒ W), signed direction word
   ("Bezug/Einspeisung") from one shared formatter.
9. **X9 — Component forks.** Spectrum bar exists as `.spectrum` (green→red, Ü) and `.spec`
   (red→green, E) — same silhouette, opposite reading direction (OD5); magnitude bar in
   3 vocabularies/heights (6/7/8px); tile radius/state-sets fork (Ü vs S); `.room` means
   three different things (Ü 26/54px, K 22/42px + spark, Musik unrelated); battery icon
   copy-pasted twice + a third divergent glyph; list rows in four gap rhythms (14/6/10px).
10. **X10 — Section-header grammar split.** DS/Übersicht = headline-free cards; the five
    other tabs use `.card-h` caps (15px on E vs 14px; divider on E/K/D, none on S/M).
    Formalize: headline-free overview, one `.card-h` spec on detail tabs (OD3).
11. **X11 — Device-level health is homeless.** Diagnose says "Alle Quellen aktuell" while
    Klima shows soil sensors dead 66/275 days (batteries 0/2%); the ribbon can't show
    offline vs secure (UNREACH exists on Main's ribbon since June — but no *status word*);
    nothing anywhere says "change these batteries". Device/battery fleet section on
    Diagnose + headline logic includes device freshness.
12. **X12 — DESIGN_SYSTEM.md is stale against its own reference** (documents 88/112,
    ships 98/126; `--sym-wx:108` defined, 84px hardcoded in Klima). Reconcile with OD2.

## Übersicht (U)

- **U1** — Energy-flow bars normalize to the current max: Haus 306 W renders a full amber
  bar — same picture as 3 kW. Bar carries rank only, no magnitude. Fix: fixed scale
  (0…house max, e.g. 4 kW) for all four rows (value keeps the verdict colour; fill uses a
  role tint, not full amber — see OD4 note on "aktiv"-amber).
- **U2** — Ribbon: red Türschloss dot carries no status word ("entriegelt"?), and idle
  battery icons ×5 carry none either; offline state must be visually distinct from
  "secure" (status word + hollow/grey dot). (DS Indicator component already specifies
  dot·name·status·battery.)
- **U3** — E5 value red while its own knob sits mid-band (amber zone); Diesel consistent.
  One band logic for value colour + knob position (likely two threshold sets in code).
- **U4** — Card header "0,00€/h" unlabeled (Energie calls it "Jetzt"); "0,33€/kWh"
  no-space (X6).
- **U5** — Missing domain verdicts: lights (3 are on — Übersicht is silent), music,
  Warmwasser. Additive chips ("3 Lichter an"), nothing removed.
- **U6** — "TV · Szene" tile label collides with Steuerung's light "TV · aus" — rename to
  "Fernsehabend" (the scene's name on Steuerung) or mark scene tiles visually as actions.
- **U7** — Calendar: 57px dead bottom vs 14px top inset (size card to its 7 rows);
  title truncation eats kids' event locations ("Berliner Meisterschaft…"); "Wertstoffe
  ( 👷 durch ALBA)" stray space.
- **U8** — Hero min/max verdict-coloured here but muted on Klima (K4) — align (same
  Metric treatment both heroes).

## Energie (E)

- **E1** — Re-cut to the `.mv2` skeleton (X3/B4): legacy 386/6px grid, 8px mid-column gap,
  0px nav clearance, ragged x16-vs-x20 text inset under the chart.
- **E2** — LIVE-LEISTUNG reads "dead" at night: kW with one decimal turns 5–341 W of real
  activity into "0,3/0,0/0,3 kW" with empty bars, while the house is running fully off
  the battery — the actual story. Adaptive units (X8), fixed bar scale (U1), and split
  **PV / Akku / Netz / Haus** rows (the overview's split is *finer* than the detail
  tab's — inverted altitude). Add battery SoC row when a data path exists (Maxxisun CCU2
  still blocked — until then show the derived discharge estimate, labeled ≈).
- **E3** — ~210px empty band mid-card (bars end y≈355, Phasen table starts y≈565); HEIZUNG
  ~110px empty bottom. Size cards to content in the re-cut.
- **E4** — "STROMPREIS · 48 H" shows ~29 h (measured via tick spacing); x-axis stretches
  with data availability so window widths aren't comparable day-to-day; curve ends
  unlabeled; no y-anchors (min/max €); pill "0,33 €" and callout "Ø 0,19 €" lack /kWh.
  Fix: fixed 48 h axis with a visible "keine Daten" zone (or dynamic title "bis Fr 24:00"),
  min/max anchors, consistent unit. The günstig-window highlight itself is the best
  element on the tab — keep.
- **E5** — Tomorrow's cheap window is the most decision-relevant fact on the page and the
  smallest text. Repeat it as a chip/row in STROMKOSTEN ("morgen 13:30–15:30 · Ø 0,19").
- **E6** — VERLAUF: "Monat 0,54 € vs 18,04 €" green on July 2 compares 2 days vs 30 —
  verdict is structurally always green at period start. Compare like-for-like
  (period-to-date) or colour only when comparable; also **verify `cost_this_day`**: live
  state = 0,332… € at 0,2 kWh (≈1,66 €/kWh) — plausible only if it includes a standing
  charge; if so, label it; if not, fix `tibber_states.js` compute (note the known Pi
  timezone/day-boundary issue).
- **E7** — HEIZUNG: Vorlauf 38,4° < Rücklauf 55,0° at Ventil 0% (reads as swapped
  sensors; possibly WW-priority stagnation — verify against the boiler), and
  `hotwater_return` ≡ `storage` = 59,3° exactly. Temperatures carry no verdict (weiß,
  weight 700) — at minimum band the Speicher temp; dim temps when Ventil = 0%.
- **E8** — AUTARKIE spectrums: full red→green gradient always visible → two half-red bars
  on a perfect day; knob half-clipped at 100%; "100 %" printed twice (value + end label);
  the real context (Ø 7 Tage 88/72%) is text-only. Fix: Ø as a tick on the track, muted
  end labels, knob clamp inside; direction per OD5.

## Klima (K)

- **K1** — B2 (soil card clip) + list rows off-token (31px rows/14px gaps — X9 list-row
  unification).
- **K2** — Dead soil sensors are the page's most alarming fact and its quietest pixels:
  "vor 66 d/275 d" muted, titles full-white. Age beyond threshold → amber/red label, row
  dimmed, "offline · Batterie leer"; mirror into Diagnose (X11).
- **K3** — Room sparklines: four near-identical flat amber lines, no y-anchor; if each
  autoscales its own min/max, 0,5 K noise looks like the outdoor day curve (verify).
  Shared y-domain across room cards (couple to the existing "heute 25°/26°" labels) or
  drop when the band is monotone. Hero 24h curve (best chart concept on the wall): wider,
  min/max anchors at the extremes, time ticks beyond "24 h".
- **K4** — Hero "15° min 27° max" muted vs Main's verdict-coloured "15 °C/27 °C" (U8);
  format also drifts (° vs °C).
- **K5** — Forecast row "Do" is already past at 20:33 (27° was this afternoon) — mark
  "heute" or start at Fr. Trend arrow appears only on Wohnzimmer — conditional or bug
  (verify); if conditional, the convention is invisible.
- **K6** — Valve list looks tappable (same pill optic as buttons) but is display-only
  (control lives on Steuerung — fine): show WATERING + remaining time when running, and
  surface the "Dachterrasse zu · vor 32 d" anomaly among "vor 13–15 h" neighbours.
- **K7** — 6-day range bars: shared scale verified working (nice) but invisible — one
  muted reference tick (e.g. 20°) through all rows would prove it; track domain
  (week min→max) unlabeled.

## Steuerung (S)

- **S1** — Frame re-cut: 8px page inset, 8px section gaps, ~10px internal padding → 4/12/
  12 (X3).
- **S2** — Rollläden "100 %" — open or closed? Add direction word ("offen") or filled
  shutter glyph; "Alle" tile shows the word "alle" as its value (leave empty); "100 %"
  spaced vs "50%" unspaced on the same tile (X6). Blue value text reads as a link.
- **S3** — "Maxxi Akku · 0 W" amber-active while Übersicht shows Maxxisun 269 W discharge:
  the plug is unidirectional (charging only) and nobody told the family. Label "lädt: 0 W"
  (and see X8 for the naming). Verify plugs show live W when on (concept promises it —
  all others are off in the capture).
- **S4** — "tippen = 10 min" ×6 is noise: move to the section header once; tiles show
  state/remaining time after tap (verify countdown renders). "Garten Stop" permanently
  red while idle → dim when nothing runs, red only during watering.
- **S5** — Ambiente light controllable only via Übersicht tile — add to LICHTER (additive;
  tab claims the *full* control surface).
- **S6** — Positive: the light tile (amber frame + icon + "an") is the clearest
  tappable/state pattern on the wall — the reference for X9's tile unification.

## Diagnose (D)

- **D1** — Headline blind spot (X11): "Alle Quellen aktuell" true for feeds, false for
  devices. Add device/battery fleet card (HmIP LOW_BAT + UNREACH, Netatmo modules, Gardena
  sensors) and fold device-death into the banner verdict.
- **D2** — SYSTEM·PI card justifies 5 rows across 596px (~93px gaps, first row 78px lower
  than neighbours) — top-align on one gap token. RAM/Disk "frei" without capacity ("1,2 GB
  von X" or % + bar like CPU); "14%"/"1,2GB" vs "112 d" unit drift in one card (X6).
- **D3** — List-row gaps 6px (off `--s2`, and a fourth rhythm — X9); 8px frame gaps → 12
  (X3).
- **D4** — "daswetter · geplant" unexplained between "ok"s; Netatmo "3 min" here vs
  "vor 10–11 min" on room cards (newest-module vs per-module — label it).
- **D5** — Positive: banner + "Stand 20:34 Uhr" + per-source freshness thresholds is the
  cleanest verdict pattern; keep as the model for X7's escalation rule.

## Musik (M)

- **M1** — Frame re-cut: own grid (8px margins, 10px gutter, 8px nav gap) → 4/12/12 (X3);
  zero tokens in the script (X2).
- **M2** — Offline row (Studio "–") keeps fully-active-looking −/▶/+ buttons — dim the
  row, write "offline"; Fernsehzimmer's missing play button leaves a 72px hole in an
  otherwise strict column rhythm — reserve a ghost/disabled slot with a reason ("TV").
- **M3** — GRUPPEN pills: three icon colours, no active-state marking, no feedback about
  current grouping (verify what the icon colours encode — deko or state?). Active pill
  gets the tile-on treatment (S6 pattern).
- **M4** — Volume is a naked number (5…39 of ?): add the house magnitude bar (exists for
  exactly this) or "/100"; "spielt" in green would be the tab's only necessary
  wall-distance verdict ("gestoppt" vs "pausiert" currently indistinguishable in
  weight); no now-playing line (track/source) — the single biggest utility gain.

## Owner decisions (OD) — needed before/while executing

1. **OD1 — The alarm red.** #A00629 fails WCAG-AA on dark (archived change) and a second
   red #d8536f already crept in (ribbon/arm). Options: keep #A00629 (ground truth) and
   eliminate #d8536f; or bless #d8536f (or another AA red) as *the* alarm red and retire
   #A00629 for text-sized uses. One red, one meaning.
2. **OD2 — Canonical token values.** DS says --t-hero:88/--t-clock:112; the shipped
   reference (main_v2.js) says 98/126 and looks right on the wall. Bless the shipped
   values (update DESIGN_SYSTEM.md) or the documented ones (change main_v2). Same for
   --r3 (10 vs 12) and the caption floor (11px exists on K/M).
3. **OD3 — Section-header grammar.** Formalize: overview = headline-free, detail tabs =
   one `.card-h` spec (14px? divider yes/no?). Today it's five variants.
4. **OD4 — The verdict table.** One sign-off table for: Strompreis (banded everywhere or
   detail-tab muted?), Autarkie (75 vs 80 cut, muted vs red floor), Eigenverbrauch (blue
   vs green — pick one), Hausverbrauch amber threshold (150W vs 3000W), production
   (75 vs 200W), valve running (green vs blue), and the "aktiv"-amber question: full
   amber for "on/active" (tiles, Ventil·aktiv, Maxxi) competes with amber = middle
   verdict band — proposal: active = amber-16 tint frame, full amber reserved for
   verdicts (hue unchanged, only weight of use).
5. **OD5 — Spectrum direction.** Price spectra run green→red, Autarkie red→green — same
   component, mirrored reading. Options: value-axis always left-low/right-high with
   verdict colouring per position (current, formalize it) or one fixed gradient direction.
6. **OD6 — moot (B1 retracted 2026-07-04):** the wall's weather icons were always
   correct; `galeria1` stays.
7. **OD7 — Fixed scale for energy magnitude bars** (U1/E2): suggest 0–4 kW house/grid,
   0–10 kW PV? Confirm typical maxima.

## Live-verify list (carried into tasks)

`cost_this_day` compute (E6) · Heizkreis sensor mapping (E7) · sparkline y-domain (K3) ·
Wohnzimmer trend-arrow conditionality (K5) · plug wattage display when on (S3) · garden
countdown after tap (S4) · GRUPPEN icon semantics (M3) · ribbon UNREACH rendering &
status words on the wall (U2) · after every fix: wall-tablet reload + on-device check
(concept §6).
