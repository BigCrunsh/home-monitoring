# Tasks

## 1. Design system (DONE)
- [x] 1.1 Multi-expert audit of the live Main (Chrome screenshots + layout JSON); define tokens + concepts
- [x] 1.2 Capture in `vis/DESIGN_SYSTEM.md` + add tokens/classes to `vis-user.css`
      (additive — no visual change, Chrome-verified). Committed ef6c777.

## 2. Restyle Main onto the system (each pass: deploy → Chrome screenshot + zoom → show user)
- [ ] 2.1 `vis_card.js` shared global helper (`cardChrome/semColor/arrow/label/kpiBar` + FONT/COLOR
      tables) + `*_sem` companion states in the publishing scripts (tibber/solaredge/sam/netatmo/
      tankerkoenig) — the two-layer palette
- [ ] 2.2 Fonts → `--fs-*` scale (one size per role; outside-temp + clock stay 84px; eliminate keyword sizes)
- [ ] 2.3 Colours → `*_sem` bindings + red-discipline (door labels neutral; forecast max → amber; red = alarm only)
- [ ] 2.4 Fix Weather nav icon (`w000551` → `nav_weather.png`); normalise gutters/grid (386 col / 6 gutter /
      4 margin); fix `w000486` left 2→4
- [ ] 2.5 Bigger **green-framed** Energiefluss card (`.card--accent`) owning Strompreis + Stromkosten
      (Einkauf/Gewinn/Gespart) + Autarkie + Eigenverbrauch; real `vis-icontwo` icons (no emoji)
- [ ] 2.6 Move **Heizkreis + Warmwasser** panels Main → Energy tab (user-approved 2026-06-16; frees the left column)

## 3. Roll out — new tabs (each: build → deploy → wall verify)
- [x] 3.0 Nav renamed: Overview · Energy · Climate · Control · Diagnostics (2026-06-27)
- [x] 3.0 Custom SVG icons: nav_main.svg (2×2 grid) + nav_deprecated.svg (archive) deployed to vis-icontwo/Custom/
- [x] 3.1 **Energy tab** — `energy_tab_v2.js` deployed; 5 HTML/CSS widgets (left/mid-top/mid-bot/right-top/right-bot);
      vis-views.json updated (chart→110px, 5 new tplValueStringRaw, nav→688px); pending wall verification
- [ ] 3.2 **Climate tab** — new HTML/CSS view replacing old Weather (51 widgets); outdoor hero +
      4 room CO₂ cards; confirm Carlottas/Claras module mapping before build
- [ ] 3.3 **Control tab** — new view in slot 5; full light/shutter/plug surface from old Main;
      decision: native i-vis-universal tiles vs. HTML/CSS
- [ ] 3.4 **Diagnostics tab** — new HTML/CSS view; adapter status + Pi metrics + data freshness;
      replaces empty Advanced after cost cards move to Energy
- [ ] 3.5 Remove old Main view after Control tab wall-verified; retire old_main_reference.png to archive

## 4. Spacing & alignment concept + full audit (user-requested 2026-06-16)
- [ ] 4.1 Define a written spacing/alignment concept: column grid, gutters (H==V), card padding, baseline rules,
      label↔value↔unit alignment, and MINIMUM clearances (no tight pixel fits — robust to tablet font metrics)
- [ ] 4.2 Audit EVERY text / box / panel / tile on every view for cuts, clipping, overlap, and misalignment;
      rebuild offending blocks to the concept (Diesel/E5 price block is the first concrete case)
      - Fuel-price max/min range: tankstelle superscript + max/min labels landed as a *functional* placeholder
        (user: "fine for now"); its visual treatment (hierarchy, label style, whether €/l returns) is to be
        redesigned holistically here, not polished ad hoc.
- [ ] 4.3 Verification discipline: after each deploy, FORCE the wall tablet to reload (file-write does not auto-push
      to connected vis clients) and confirm the change on the live screen — never report "fixed" from a fresh-loading
      capture alone. See memory `verify-before-claiming-fixed`.

**MUST-KEEP (restyle only, never silently drop):** outside-temp hero, room temps + trend arrows,
Strompreis, Stromkosten (Einkauf/Gewinn/Gespart), Autarkie, Tankpreise, multi-day forecast, calendar,
all controls, the Energiefluss flow. Nav container `w000547` never moves.
