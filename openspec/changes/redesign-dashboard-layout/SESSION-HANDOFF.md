# Session Handoff — Dashboard work (as of 2026-06-19 evening)

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
- ⬜ **Heute** (calendar/today), **Energie** (port the hub into Bubble style), **Steuerung**
  (controls — the only INTERACTIVE zone → must use native tappable vis widgets, not SVG).

**Owner decisions captured:** battery + last-update shown **always** (not alarm-only); comfort =
old bands; all rooms = bedrooms; keep-more; Bubble aesthetic; verdict-led. **Pending:** move
per-room *history/trends* into a tap pop-up / Klima tab (snapshot on Main); final prune pass.

## 4. Next steps
1. Commit the uncommitted production work (Maxxisun-charge fix; rooms 2×2 + heating removal).
2. Continue Neu: build **Energie** (hub in Bubble style) and **Heute**, then **Steuerung**
   (native interactive widgets). Then a prune/move pass with the owner.
3. On sign-off: promote Neu → Main; roll the system to Weather/Advanced (renamed to zones).

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
