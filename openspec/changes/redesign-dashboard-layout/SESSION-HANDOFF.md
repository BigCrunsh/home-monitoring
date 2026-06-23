# Session Handoff — Dashboard work (as of 2026-06-19 evening)

> 🚢 **DELIVERED 2026-06-23 (this session) — deployed live, ready to commit.**
> • **Weather symbol** = native daswetter art now **inline** in the hero (`wxImg()` → `<img
>   src=/daswetter.admin/icons/tiempo-weather/galeria1/{Wetter_Symbol_id}.png>`) beside the big temp;
>   humidity label trimmed to make room. Replaces the old `w001004` overlay widget idea (inline
>   auto-aligns + scales + survives Neu→Main). Render-verified.
> • **Steuerung = the agreed 6 tiles + symbols** (TV · Ambiente · Drucker · Couch · Vitrine · Tür) —
>   NOT the lights/Maxxisun set the older notes below describe (that was a wrong turn, reverted).
>   Tiles are state-reactive: Drucker/Couch/Vitrine/Ambiente show real on/off (amber-on / grey-off
>   icons, same symbols); TV = scene. Interactivity = native **transparent** `i-vis-universal` Switch
>   overlays (`wov_*`, z2) over each HTML tile (the card is a read-only HTML string, so taps must come
>   from native widgets). Tür = HmIP-DLD smart-lock `LOCK_TARGET_LEVEL='OPEN'` (string enum, the same
>   write as the old `w000526` button) behind a **2-step guard**: `tuer_arm` helper in `steuerung.js`
>   + transparent arm (z2) and a visible red "Tür öffnen bestätigen" confirm (z3,
>   `visibility-oid=tuer_arm`). Owner tap-verified the 5 toggles + the Tür opener on the wall.
> • Overlay boxes were measured from the rendered tiles (3-col×2-row, 107×88; vis-px = tile + 4).
>   Reproducible generator + measure scripts in the session scratchpad.
> • **Open question**: the SVG-era Maxxisun guard widgets (`wstMXA/wstMXC`) are gone (Maxxisun isn't
>   in the agreed 6 tiles), so the `mx_arm` half of `steuerung.js` is now **orphaned/dead** (harmless).
>   Maxxisun is still switchable only from the old Main view's unguarded `w000411`. Decide on
>   Neu→Main promotion: keep dead guard, remove it, or re-add Maxxisun control. See [[maxxisun-ccu2-integration-blocked]].
> • Code-review gate (2026-06-23): **clean, no correctness bugs.**
>
> ✅ **HTML/CSS REBUILD LIVE + VERIFIED ON THE PI (2026-06-22, Main2/Neu).** `main_v2.js` = HTML/CSS
> builders in an `<svg><foreignObject>` (scales-to-fill the 1170×676 widget); foreignObject renders
> fine in the Pi Chromium. All display zones live + match `scratchpad/mockup.html`. Token system in
> `scratchpad/TOKENS-audit.md`. Type = Archivo/Archivo Expanded. **DEPLOYED but UNCOMMITTED in git**
> (old SVG `main_v2.js` recoverable from git HEAD). Deploy recipe: `scp main_v2.js` → `iobroker object
> set script.js.common.main_v2 common.source="$(cat /tmp/main_v2.js)"` (cmd-subst is shell-safe incl.
> backticks) → toggle `common.enabled` false/true; vis view: `scp vis.json` → `iobroker file write
> /tmp/vis.json vis-2.0/main/vis-views.json`. Screenshot: tunnel `ssh -fN -L 18082:localhost:8082` +
> `node /tmp/dashshot/shot_main2.js` → /tmp/dash_main2.png. Pi host `pi@raspberrypi` (authorized).
>
> **FIXED this round (all live):** (1) **CSS class collisions** — generic class names collided with
> vis-2 widget CSS: `.day`←yahoo.css, `.clock`/`.date`←simpleclock.css (forced grey/shadow/squish),
> `.card`/`.card--accent`←vis-user.css (harmless, overridden). Renamed `day→drow`, `clock→m2clk`,
> `date→m2date` (scan-verified: was the root of "so many things wrong"). (2) **HAUS ribbon** built +
> live (`main_v2_ribbon` state + widget `w001005` @ left404 top688 766×87): contacts `value.window`
> {0 CLOSED,1 OPEN} — Terrasse `hm-rpc.1.0007DD8996AFD3.1.STATE`, Schuppen `…00155D89A38D55.1.STATE`,
> Haustür `…0023DD89A5152D.1.STATE`, Bad `…0007DD89B41FD4.1.STATE`; lock LOCK_STATE {1 LOCKED,2
> UNLOCKED} `…002A226996B89C.1.LOCK_STATE` (green=secure/red=offen|entriegelt). (3) **Calendar
> symbols+dedup** — `calSym()` replicates the old `ical_events.js`: `[Geburtstag]`→🎁 `[Hochzeitstag]`→💍
> `[Müllabfuhr]`/`Abholung`→👷 `[Carlotta]`→🩵 `[Clara]`→💜 `[Clea]`→🧡; dedup repeated events.
> (4) **Icons** moon/humidity/pressure/sun redrawn bigger+cleaner.
>
> **REMAINING BUILD — decisions made (2026-06-22):**
> • **Weather symbol** = **native daswetter art near the temp** (owner pick): re-add overlay `w001004`
>   (`tplStatefulImage8`, oid `daswetter.0.NextDays.Location_1.Day_1.Wetter_Symbol_id` → galeria1 imgs)
>   into the hero beside the big temp; shrink the humidity/pressure block to make room; verify
>   alignment on the Pi. (Hero is currently full.)
> • **Steuerung interactive restore** = the OLD control set as native `i-vis-universal` tap widgets
>   overlaid on the HTML Steuerung tiles (z≥2, vis-px≈design+4; §4b recipe), restyled. `main_v2.js`
>   already has `LIGHTS`/`GARD`/`VALVES` arrays; buildSteuerung still renders the mockup's 6 tiles —
>   rework it to the old set as state-reactive tiles, then overlay the natives. Targets:
>   – Lights (Switch, .on/.STATE bool): Küche `hue.0.Küche.on`, Esstisch `hue.0.Esszimmer.on`, Wohnen
>     `hue.0.Wohnzimmertischlampe.on`, Flur `hue.0.Flur.on`, Büro `hue.0.Arbeitszimmerlicht.on`.
>   – Maxxisun: 2-step guard (`javascript.0.mx_arm` + `hm-rpc.1.0001DD89A46CA5.3.STATE`) via the
>     existing `steuerung.js` (arm reveals the real switch 5 s, 2nd tap fires).
>   – TV = `scene.0.Fernsehabend` (Switch). Ambiente = `hue.0.TV-Bereich.on` (Switch).
>   – Garten (i-vis-universal `State`, write seconds to `…duration_value`): `GARD = smartgarden.0.
>     LOCATION_28b39c94-…DEVICE_b193e1f6-…SERVICE_VALVE_b193e1f6-…` + `-3A{1..6}.duration_value`
>     (Rand/Vor/Trauf/Dach/Gart/Hoch); stop = `…SERVICE_VALVE_SET_b193e1f6-…stop_all_valves_i`.
>     **Decision: ADD the valves but DO NOT auto-test (real watering)** — test only lights/Maxxisun/scenes.
> • Then **commit** (ask first) + promote Neu→Main.
>
> **Layout (converged):** hero = clock (left) · sun/moon almanac (centre) · humidity+pressure aligned
> to auf/unter + big outside temp top-aligned with the clock + big stacked min/max (`value + °C/min`).
> 3 zone columns: **Klima** (4 rooms, 3-tier: name / `vor Xmin`+battery / humidity+CO₂; temp big,
> "warm" bottom-aligned to env line) · **Woche** (all events/day, time-sorted, trims trailing days,
> Sa+So+today row-tinted) + **Tanken** (Diesel/E5 spectrum bars, fixed price col so both align) ·
> **Energie** (status + Strompreis spectrum bar + 4 flow magnitude rows + inline Autarkie/Eigenverbrauch
> stats) + **Steuerung** (mockup's 6 tiles — being reworked to the old control set, see above). Bottom
> strip = nav bar (left) + **HAUS ribbon** (read-only door/window/lock dots) — built + live (`w001005`).
>
> **NEXT:** (1) deploy + screenshot-verify on the Pi when authorized (`pi@raspberrypi` /
> `raspberrypi.fritz.box` / 192.168.178.47); fall back from `foreignObject` if it doesn't render.
> (2) **Steuerung interactive** controls + the **HAUS ribbon** need a real state-ID inventory on the
> Pi — only Hue/Couch/Maxxisun/Gardena verified; **TV-scene, Ambiente-scene, Türöffner, Vitrine,
> Drucker, and the door/window/lock sensors are UNVERIFIED**. (3) Weather symbol is a drawn glyph
> placeholder — decide: keep, or restore the native daswetter art overlay (DESIGN_SYSTEM exception).
> (4) Ask before committing the new `main_v2.js`. Path note: home is `/Users/christoph`.

Pick-up note for the next session. The ioBroker vis-2 wall dashboard (Pi @ `pi@raspberrypi`
= 192.168.178.47 / raspberrypi.fritz.box; InfluxDB 1.8). Hostname can transiently fail to
resolve — that's a local network blip, retry.

## 1. What shipped this session (committed on master)

| commit | what |
|---|---|
| `045c4a8` | **SolarEdge live production via Modbus TCP** — new `solaredge_modbus.js` polls the SE3680H @192.168.178.127:1502 every 6 s (raw `require('net')`, AC power 40083/40084 + WattNode grid 40206/40210). Hub `solaredge_power.js` prefers it (mode `modbus`) over the 15-min cloud, falls back when asleep. |
| `9d6c8e3` | **Haus = appliance load** — `computeHybrid` excludes Maxxisun battery charging (`production + grid − maxxiCharge`). |
| `28770da` / `937791a` | **role × magnitude colours** on the hub + Energy-tab cards. green=favourable / yellow=normal-cost / red=high-cost / grey=neutral. |
| `800f3cc` | **7-day self-consumption fix** — `WHERE Consumption > 0` (cloud back-fills late). |
| `53d9c1a` | **price band by 7-day p20/p80** (not today's min/max — a few peak hours were making 0,36 read "günstig"). |
| `402d899` `2ac0c92` `151184d` `d7b444c` `31c268a` `1baf99e` | Energy tab (6 cards), its concept doc, the Energiefluss hub + Main tidy, heating plausibility guard, tankstelle superscript, earlier concept docs. |

The Energiefluss hub (Main, `javascript.0.energy_flow_card`) and the Energy tab
(`javascript.0.et_*`) are **done + live + verified**. Daytime production confirmed.

## 2. Uncommitted work on disk (survives the clear; decide what to commit next)

- **`solaredge_power.js` (M)** — Maxxisun **charge** threshold: yellow ≤500 W, **red >500 W**
  (`roleCol(val, fav, high)` + `mxCol = roleCol(maxxi, maxxi<0, 500)`). Deployed + live.
  Clean single-file change → **commit first** (`fix(dashboard): Maxxisun charge red above 500 W`).
- **`vis/main/vis-views.json` (M)** — TWO things mixed in here:
  1. **Main rooms reflowed to a uniform 2×2 + Heizkreis/Warmwasser removed** (heating now on the
     Energy tab). Deployed + verified production work — **should be committed**.
  2. The **Main2 prototype** view + a "Neu" nav button + a weather-icon widget (see §3).
  ⚠ Both are in the same file; no clean hunk-split. Likely commit the whole file as the rooms-2×2
  work and note the prototype tab rides along, or split via crafted `git apply` patches.
- **`main_v2.js` (??)** — the Bubble prototype script (see §3). New script object already created
  on the Pi (`script.js.common.main_v2`).
- **`main-concept-bubble.md` (??)** — the Main-redesign concept + the reproducible Bubble-token
  method (§7b). Commit with the prototype.

## 3. ACTIVE WORK: the "Neu" tab — Bubble-style Main redesign (prototype)

Non-destructive prototype on a separate **`Main2`** view (nav button "Neu"), so the live Main is
untouched. Rendered as one SVG → `javascript.0.main_v2_card` by `main_v2.js`, shown via a
`tplValueStringRaw` widget; clock/data in-SVG, the weather icon is a native `tplStatefulImage8`
overlay. Compare by tapping Main ↔ Neu.

**Design system (agreed with the owner):**
- Aesthetic = **Bubble Card** (Home-Assistant-only → recreated in SVG). Authentic tokens pulled
  from `Clooos/Bubble-Card @612aaaa`, reproducible method in `main-concept-bubble.md §7b`:
  **rows are pills (radius = height/2), circular icons (50%), icon 24 px, card radius ~32**.
- **Verdict-led**: numbers carry a colour verdict. green=favourable, yellow=normal, red=high/alert,
  grey=neutral. **Keep-everything** (owner: "add all info + icons, ask before removing").
- Two reading distances: glance band (time+date+weather, big) read across the kitchen; zones up close.

**Zones (1:1 with future tabs):**
- ✅ **Glance band** — time · German date · weather symbol · big Außen temp · forecast ↓min ↑max
  · Aufgang/Untergang · Luftdruck (trend arrow).
- ✅ **Klima** — 5 pill bubbles (Außen + 4 rooms): circular thermo icon · name · 💧humidity · CO₂+verdict
  (lüften) · 🕐last-update · 🔋battery · temp+comfort word. Comfort = the **OLD bands** (≤3 grey /
  <12 blau / <20 grün / <27 gelb / ≥27 rot); all rooms treated as bedrooms.
- ✅ **Tanken** — Diesel (primary) + E5 pill rows: pump icon · tankstelle price (1,69 + raised ⁹) ·
  günstig/teuer verdict (14-day p20/p80) + "→ tanken/warten" · min/max range.
- ✅ **Heute** — today's events from `ical.0.data.table` ({_date,event,_allDay}): blue dot · time
  (or `ganztägig`) · title (XSS-escaped, clipped). "Keine Termine heute" when empty; "+N weitere"
  past 5 rows.
- ✅ **Energie** — the Energiefluss hub recreated in Bubble style from the values it already
  publishes (no recompute): status headline + grid kW, Strompreis verdict (7-day p20/p80 band) +
  net €/h, four role-coloured flow rows (SolarEdge/Maxxisun/Netz/Haus) with magnitude bars, Autarkie
  bar. **SolarEdge-only is reconstructed** as `power_production − max(0,−power_maxxisun)` because
  `power_production` folds in Maxxisun feed-in — otherwise the battery double-counts across rows.
- ⬜ **Steuerung** — controls; the only INTERACTIVE zone → must use native tappable vis widgets,
  not SVG. **Scope (owner): Maxxisun battery + Gardena irrigation + lights/plugs.** Next: inventory
  which target states are actually *writable* (the scripts found so far are read-only).

**Owner decisions captured:** battery + last-update shown **always** (not alarm-only); comfort =
old bands; all rooms = bedrooms; keep-more; Bubble aesthetic; verdict-led. **Pending:** move
per-room *history/trends* into a tap pop-up / Klima tab (snapshot on Main); final prune pass.

## 4. Next steps
1. ✅ Done: Maxxisun-charge fix + rooms-2×2/heating-removal committed & pushed (`e05e57d`, `ba4bf27`).
2. ✅ Done: Energie + Heute zones built, deployed, screenshot-verified on Main2.
3. Build **Steuerung** — ✅ v1 shipped + verified: **Licht** (Küche/Esstisch/Büro/Couch, verbatim
   clones of the Main switches) + **Maxxisun on/off with a two-step confirm-guard** (tap arms →
   `steuerung.js` reveals the real plug switch for 5 s via visibility binding → second tap toggles;
   arm-step screenshot-verified to NOT switch the plug, auto-disarm confirmed). ⬜ **Gardena
   deferred** — needs the `State` widget type (no existing example in the project → config
   unverified) AND the smartgarden start-write format is **untestable without real watering**.
   See §4b. Next: prune/move pass with the owner (per-room history → tap pop-up).
4. On sign-off: promote Neu → Main; roll the system to Weather/Advanced (renamed to zones).

## 4b. Steuerung build recipe (inventory + mechanism — verified, ready to build)

**Mechanism.** Steuerung must be NATIVE tappable vis-2 widgets, NOT SVG. The only interactive
widget installed is **`i-vis-universal`** (iobroker.vis-inventwo) — already used for the nav bar and
22 Switch widgets on Main. Build by **cloning a working widget** (template: Main `w000395`,
`hue.0.Esszimmer.on`) into `Main2.widgets`, overlaid at **z-index ≥ 2** over the SVG card. Vis-px =
SVG viewBox + 4, so the Steuerung zone (viewBox 788,422, 386×232) is at vis **left≈792, top≈426**.
In `main_v2.js`, change the Steuerung `ph()` to draw the panel + "Steuerung" title (+ section
labels) but DROP "… folgt"; the interactive controls overlay on top. Edit the JSON via a python
script (clone template → set fields → write back), NOT by hand. Deploy: `iobroker file write`.

**Widget field recipe** (`tpl: i-vis-universal`): `data.iUniversalWidgetType` =
- `Switch` — boolean toggle bound to `oid` (lights, plugs). `iValueType=boolean`, icons via
  `iImageFalse/iImageTrue` (`/vis-icontwo/Lights/*.png`), `iTextFalse/iTextTrue` (label),
  `iImgColorFalse=var(--color-button)`, `iImgColorTrue=var(--color-yellow)`.
- `State` — write `iValue` to `oid` on tap (Gardena start: `iValue=30`, `iValueType=value`).
- **No native confirm dialog exists** in inventwo → Maxxisun guard needs `ViewInPopup` (tap → tiny
  confirm view with a [Ja] Switch) OR an arm/fire helper state in JS (tap1 arms 5 s + SVG hint,
  tap2 within window writes the real state).

**Verified writable control states (owner scope = Maxxisun + key Hue + Couchlampe + Gardena):**
- **Lights (Hue, `.on` boolean, write:true, role switch.light):** `hue.0.Küchenlicht.on`,
  `hue.0.Esszimmer.on` (a.k.a. Esstisch — already a Main switch), `hue.0.Arbeitszimmerlicht.on`,
  `hue.0.Kinderschlafzimmerlicht.on`, `hue.0.Esstischlicht_{vorne,mitte,hinten}.on`. (Relocate the
  rooms that already have switches on Main = owner's established picks.)
- **Couchlampe (HmIP plug):** `hm-rpc.1.0001DD89A46CAD.3.STATE` (write:true). ⚠ HmIP-PSM gotcha:
  the writable relay is channel **.3** — `.2.STATE` is read-only status.
- **Maxxisun on/off (HmIP plug "Steckdose Maxxisun Akku"):** `hm-rpc.1.0001DD89A46CA5.3.STATE`
  (write:true). NOT the Shelly (that MQTT plug is read-only — the "unidirectional" note). ⚠ OFF cuts
  battery charge AND feed-in → **confirm-guard required**.
- **Gardena (smartgarden.0):** LOCATION `28b39c94-…`, DEVICE `b193e1f6-…`. Start a valve = write
  seconds (default 30) to `…SERVICE_VALVE_<dev>-3A{n}.duration_value` (write:true, role text). Stop
  all = `…SERVICE_VALVE_SET_<dev>.stop_all_valves_i` (write:true). Valves: 3A1 Randbeet · 3A2
  Vorgarten · 3A3 Traufkiesstreifen · 3A4 Dachterrasse · 3A5 Garten · 3A6 Hochbeet. (IDs use `-2D`
  for `-` and `-3A` for `:`.) NB: `duration_leftover_i` is read-only — not the command.
- Other available (not in v1): HmIP `Steckdose Vitrine/Drucker` (.3.STATE), Rollladen
  `Terrassentür/Seitenfenster` (`.LEVEL`).

**Verify after build:** screenshot Main2 (widgets render) + puppeteer click → confirm the bound
state actually changes (interactivity can't be confirmed by a static screenshot alone).

## 5. Technical reference
- **Deploy existing script:** `scp X.js pi@raspberrypi:/tmp/` →
  `iobroker object set script.js.common.NAME common.source="$(cat /tmp/X.js)"` → toggle
  `common.enabled` false/true.
- **Create NEW script:** `object set <id> "<=-free stub JSON>"` (object-set treats any value with `=`
  as a property update, so the stub JSON must contain no `=`), then set `common.source` via the
  property form, then `common.enabled=true`.
- **Deploy vis:** `scp vis-views.json pi@raspberrypi:/tmp/vis.json` →
  `iobroker file write /tmp/vis.json /vis-2.0/main/vis-views.json`.
- **Screenshot:** `ssh -fN -L 18082:localhost:8082 pi@raspberrypi` then
  `node /tmp/dashshot/shot.js` (#Main) / `shot_main2.js` (#Main2) / `shot_energy.js` (#Energy) →
  `/tmp/dash_*.png` (2600×1640). Crop with PIL. Coord map: SVG card at vis left4, viewBox 1170×676,
  render ≈ vis×2; Main2 zone X in viewBox ≈ render `(X+4)*2`.
- **Key state IDs:** climate `netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c[.SUB].{Temperature.Temperature,Humidity.Humidity,CO2.CO2,LastUpdate,BatteryStatus}`
  (Wohnzimmer = main; Carlotta `03-00-00-0e-16-36`; Clara `03-00-00-0f-01-6e`; Clea `03-00-00-10-e5-42`;
  Außen `02-00-00-32-ae-a4`). Pressure `…70-ee-50-32-c3-4c.Pressure.Pressure` (+ PressureTrend).
  Sun `javascript.0.sunrise/sunset`. Forecast `daswetter.0.NextDays.Location_1.Day_1.{Minimale,Maximale}_Temperatur_value`,
  icon `…Wetter_Symbol_id`. Fuel `tankerkoenig.0.stations.1.{diesel,e5}.feed` +
  `javascript.0.tankerkoenig_quantiles.{diesel,e5}_{min,max,p20,p50,p80}`.
- **Verification lesson:** the puppeteer/Chrome capture renders fonts narrower than the iPad —
  prefer clearance over tight fits; confirm tight cases on the device. Read live values non-atomically
  ≠ reliable (production swings under cloud) — compare same-render (screenshot) values.
