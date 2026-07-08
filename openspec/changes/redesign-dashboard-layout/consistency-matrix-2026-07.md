# CSS/Design-token Consistency Matrix — 2026-07-02

Static extraction across the six tab scripts (companion to `holistic-review-2026-07.md`;
line numbers as of commit d0f12db). Reference: `integrations/iobroker/DESIGN_SYSTEM.md` (DS).
Files: `main_v2.js` (Übersicht), `energy_tab_v2.js` (Energie), `klima_v2.js` (Klima),
`steuerung_v2.js` (Steuerung), `diagnose_v2.js` (Diagnose), `musik_v2.js` (Musik).

## 1. CSS architecture & tokens

| Fact | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| CSS block | Own `CSS_BASE` (main_v2.js:15–170) **plus separate `RIBBON_CSS`** (:568–580) | Own array-join `CSS` (energy_tab_v2.js:14–69) | Own copy (klima_v2.js:15–113) | Own copy (steuerung_v2.js:11–44) | Own copy (diagnose_v2.js:10–55) | Own copy (musik_v2.js:19–51) | **Yes — 7 hand-copied blocks, nothing shared** |
| Root/namespace class | `.mv2` (+ `.mv2r`) | **`.et2`** (:16) | `.mv2` | `.mv2` | `.mv2` | `.mv2` | **Yes — Energie own namespace** |
| SVG wrapper | viewBox + preserveAspectRatio → scales to vis box (:636–638) | Fixed px, **no viewBox** (:72–79) | Fixed px (:208–214) | Fixed px (:197–200) | Fixed px (:111–116) | Fixed px (:131–134) | **Yes — only Übersicht scales-to-fill** |
| Spacing tokens | `--s1..--s6` (:22) | `--s1..--s4` (:20) | `--s1..--s6` | **`--s1,--s2` only** (:18) | `--s1..--s6` | **none** | **Yes — 3 subsets; Musik zero** |
| Radii | `--r2:14 --r3:10` = DS | same | same | **`--r3:12`** (:18) | same | **`--r3:12`** (:26) | **Yes — r3 12 vs 10 (DS: 10)** |
| Type tokens vs DS (88/112/27/18/14/12) | **`--t-hero:98 --t-clock:126`** + `--t-date:23` (:24) | **`--t-hero:30 --t-big:22 --t-sub:18 --t-label:15 --t-cap:13`** (:23) | as Übersicht (:24) | `--t-label:14 --t-cap:12` only (:19) | **`--t-hero:48`** unused, rest DS (:19) | **none — all px literals** | **Yes — `--t-hero` = 98/30/48 vs DS 88; clock 126 vs 112; Energie label/cap 15/13** |
| Palette tokens | 4 colors + all 5 `-16` tints (:20–21) | 4 colors, **no tints, no `--mute`** (:17–19) | 4 + 5 tints | 4 + 5 tints | 4 + 5 tints | 4 colors, only 3 tints (:25) | **Yes — tint set incomplete E/M** |
| Verdict colors sourced as | CSS vars (`GREEN='var(--green)'` :173) | CSS vars inline | **Raw hex** (klima_v2.js:116) | Raw hex (:46) | Raw hex (:57) | Raw hex (:53) | **Yes — var-based on 2, hex on 4** |

## 2. Font

| Fact | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| Google Fonts import | Figtree 400;500;600;700 (:16); **ribbon only 400;500;600** (:569) | 400;500;600;700 | same | same | same | same | Minor — ribbon differs |
| Family stack | `'Figtree',system-ui,sans-serif` | same | same | same | same | same | No |
| Display weight | 600 (DS-compliant) | **700 on hero values/flow labels/table hi-row** (:57,118–119,217,285,324) | 600 values, 700 headers (:39,100,104,395) | 600/700 header (:28) | 600/700 header (:31) | 600/700 header+`.vb` (:34,49) | **Yes — Energie big numbers 700; DS says 600** |
| tabular-nums | root + `.num` (:29,41) | root only | root + `.num` (:28,35) | root only | root only | root only | Minor |

## 3. Type sizes actually used

| Role | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| Biggest display | clock 126, hero 98 | 30 | hero 98 | 14 | 26 (48 unused) | 24 | **"hero" spans 24–126px** |
| Metric values | room 54 (:103), minmax 50 (:63), fuel 40 (:138), 27, 18 | 22, 18 | room 42 (:68), 20, 18 | 12 | 27, 18 | 14 | **room temp 54 vs 42; no metric tier S/M** |
| Labels | 14 | **15** | 14 | 14 | 14 | 16/17 | **Yes** |
| Captions | 12; `.mu` 13 (:54) | **13** | 12; 11 (:96,:111) | 12; 13 (:43) | 12 | 13/12/**11** (:44) | **floor 11/12/13 by tab** |
| Section header | n/a (headline-free) | 15 | 14 | 14 | 14 | 14 | Yes |

## 4. Palette (non-token literals)

| Fact | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| bg/surface/inset/border/text | `#0d0e12/#15161c/#1c1f28/#262a33/#CCCCCC` | same | same | same | same | same | No — identical |
| Muted greys | `--muted #8A8A8A`, `--mute #7F8A99`; `RS='#8A8A8A'` (:317), `#9aa3b2` (:340) | `--muted` only | both | both | both | both | Minor |
| Off-palette literals | **`#d8536f`** (arm/ALERT/ribbon `--red-ind` :169,:545,:570); hardcoded icon colors (:256,:328,:362); `#ffffff` (:248) | none (all var) | hex constants by design | hex (:46); `#ffffff` (:93) | hex (:57) | hex (:53) | **Yes — `#d8536f` second red; icons bypass tokens on 5 tabs** |
| Ad-hoc rgba tints | today `.09`, weekend `.12`, borders `.45–.85` (:110–111,:167–169,:462–464) | none | none | borders `.45–.55` (:34–37) | none | `.playing` `.4` (:37) | **Yes — coexist with `-16` tokens** |

## 5. Card grammar

| Fact | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| Card = surface+border+r2 | Yes (:87) | Yes (:34) | Yes (:37) | `.seccard` (:27) | Yes (:30) | `.seccard` (:33) | No |
| Card padding | `--s3 --s4` (12/16) | `12px 16px` hardcoded | **12/12** (:37) | none — `CPAD=10` px math (:168) | 12/16 | px math; room `12px 14px` (:36) | **Yes** |
| Section header | **None (DS rule)** | `.card-h` 15px 700 caps + **divider** (:35) | 14px 700 caps + divider (:39); `.gsec` 12px (:100) | 14px 700 caps, **no divider** (:28) | 14px + divider (:31) | 14px, **no divider** (:34) | **Yes — 5 variants** |
| Inner bubbles | `--bg`, r3=10 | none (tables) | `--bg`, r3; rows `7px` (:101,:105) | `--bg`, r3=**12** | `--bg`, r3, `9px` (:41) | `--bg`, r3=**12** | Yes — radius + off-grid paddings 7/8/9 |
| Verdict-tinted frame | Energie card `frameStyle()` (:461–466) | none | none | none | none | `.playing` border (:37) | unique treatments |

## 6. Components

| Component | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| Metric (`.metric/.mval/.mu/.uu/.ll`) | Yes (:52–54,305–308) | **No — `mrow`/`flowRow` inline** (:109–123) | **No — plain `.u`** | No | No — `.srow` | No | **DS §1 flagship exists only on Übersicht** |
| Spectrum bar | `.spectrum` **green→red** (:122–127) | `.spec` **red→green** (:46–50,101–107) | none | none | none | none | **fork: name + direction** |
| Magnitude bar | `.flow .track/.fill` 6px (:152–153) | `.pbar/.pfill` 6px (:43–44) | `.fcbar` 8px range variant (:84–85) | none | `.track/.fill` **7px** (:52–53) | none | **3 vocabularies, 3 heights** |
| Tile | `.tile` r10, on/scene/arm (:163–169) | none | none | `.tile` r**12**, on/open/scene/stop + `.stile` (:30–43) | none | `.gbtn` analogue (:35) | **fork: radius + state set** |
| Room card | `.room` 4-row, 26/54 (:94–103) | none | `.room` 5-row + spark, 22/42 (:60–74) | none | none | **unrelated Sonos `.room`** (:36–50) | **one name, three shapes** |
| Indicator dot | ribbon `.rind .dot` 10px (:575–576) | none | none | none | `.drow .dot` 10px, `.sum .dot` 16px (:35,:42) | none | Minor |
| Battery icon | `icoBatt` (:249–254) + `lowbatIco` | none | identical copy (:169–174) | different `icoBattery` (:89) | none | none | copy-paste ×2 + divergent 3rd |

## 7. Number/date formatting

| Fact | Übersicht | Energie | Klima | Steuerung | Diagnose | Musik | drift? |
|---|---|---|---|---|---|---|---|
| Decimal comma | `comma()` (:180) | `n1/n2` (:89–90) | `comma()` (:148) | int only | `comma()` (:96) | int only | No |
| Thousands sep | none (:209 kW switch) | **`toLocaleString('de-DE')`** (:88) | none | none | none | none | Minor |
| Unit styling | tight `.u` no-space (:42); superscript `.uu`; `priceSuper` (:213–218) | inline **with leading space** (:120,219,287,325) | `.u`/`.un` tight | **raw value-sized `' W'`,`' %'`** (:119,:151) | `.u` 12px (:...) | none | **4 dialects** |
| Staleness | `vor 34 s/X min/X h` (:186–190); stale>60min red; `≈` estimates (:510,:523) | `Live · Tibber…`/`≈ Schätzwert` (:206–209) | adds `jetzt`+`X d` (:153–157); `Aktualisiert vor X` (:434) | none | **bare age, no "vor"** (:98–104); `Stand HH:MM` (:136) | none | **3 grammars** |
| Missing data | muted `–` (:293) | `–` | `–`; stale soil forced `–` (:418–424) | `–` (:151) | `–` **red** via `freshCol(null)` (:105) | `–` | Minor — Diagnose alarms, others mute |

## 8. Verdict-color usage

| Quantity | Übersicht | Energie | Klima | drift? |
|---|---|---|---|---|
| Temperature comfort | ≤3 grey/<12 blue/<20 green/<27 amber/≥27 red (:191) | **not banded** (:324–328) | identical (:159) | E opts out |
| CO₂ | <1000 green/<1400 amber/red (:193) | n/a | identical (:161) | No |
| Humidity | <40 amber/≤60 green/>60 blue (:194) | n/a | identical (:162); soil <30/≤70 (:427) | No |
| Strompreis | **p20/p80 → g/a/r** (:292–296,:496) | **always muted** (:222) | n/a | **Yes** |
| Net €/h | ±0,05 break-even; red iff cost>0,05 AND price≥p80 (:456–460) | ≤0 g/<0,05 muted/<0,3 a/**≥0,3 red flat** (:198) | n/a | **Yes** |
| Autarkie | ≥75 g/≥40 a/**muted floor** (:521) | ≥80 g/≥40 a/**red floor** (:281) | n/a | **Yes** |
| Production | <75W muted, else green (:444–448) | ≥200W green (:144) | n/a | Yes |
| Hausverbrauch | <150 muted/<2000 a/≥2000 r (:444–449,:515) | **white until >3000W amber, never red** (:154) | n/a | **Yes** |
| Grid import | <150/<2000/≥2000 | >150 a/>2000 r (:148–150) | n/a | No — aligned |
| Battery | <20 r/<30 a (:359) | n/a | identical (:270,:412) | No |
| Valve watering | n/a | n/a | **GREEN "läuft"** (:395); Steuerung **BLUE** (steuerung_v2.js:35,135) | **Yes** |
| Alarm red | `--red` + **`#d8536f`** (:169,:545,:570) | var(--red) | #A00629 | **two reds** |
| Freshness age | >60min red (:352) | n/a | same (:263); Diagnose per-source (:63–72) | No |

## Top 10 drift findings (ranked)

1. Energie redefines `--t-label:15/--t-cap:13` vs 14/12 everywhere else (energy_tab_v2.js:23).
2. `--t-hero` = 98/30/48 across tabs, none matches DS 88; `--t-clock` 126 vs 112 — DS stale vs its own reference.
3. Section-header grammar split: headline-free (Ü, per DS) vs `.card-h` ×5 variants (15 vs 14px, divider inconsistent).
4. `--r3` 12 on Steuerung/Musik vs 10 elsewhere.
5. Same quantity, different verdict Ü vs E: Strompreis, net €/h, Autarkie, Hausverbrauch (see §8).
6. Energie hero numbers weight 700 vs DS "600, not 700".
7. Spectrum bar forked: `.spectrum` green→red vs `.spec` red→green.
8. Two alarm reds: `--red #A00629` vs `#d8536f` (ribbon/arm).
9. Valve running GREEN (Klima) vs BLUE (Steuerung).
10. Unit styling: 4 dialects + 3 staleness grammars.

Below top-10: Musik untokenized; only Übersicht's SVG scales via viewBox; verdict colors var-based (Ü/E) vs hex (K/S/D/M); Klima `--sym-wx:108` defined but 84px hardcoded (:25 vs :50); `.room` = three shapes.
