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

## 3. Roll out + enforce
- [ ] 3.1 Apply the system to the Energy / Advanced / Weather tabs
- [ ] 3.2 `tools/lint_vis.py` in `check_drift` (off-palette hex, off-scale fonts, nav widgets missing icons, unitless lengths)
- [ ] 3.3 Reduce absolute-positioning fragility (grouped containers / templates) where feasible

**MUST-KEEP (restyle only, never silently drop):** outside-temp hero, room temps + trend arrows,
Strompreis, Stromkosten (Einkauf/Gewinn/Gespart), Autarkie, Tankpreise, multi-day forecast, calendar,
all controls, the Energiefluss flow. Nav container `w000547` never moves.
