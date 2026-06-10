# Tasks

## 1. Unblock (periodic)

- [ ] 1.1 Re-check CCU2 local API availability (maxxisun release notes / community:
      ioBroker.maxxi-charge adapter CCU2 support, HA integrations). Last checked:
      2026-06-10 — CCU2 API in progress, not open. Next check: ~monthly.

## 2. Integrate (once API is open)

- [ ] 2.1 Design doc: API shape, polling vs push, InfluxDB schema (site tag vs new
      measurements), failure modes
- [ ] 2.2 Implement capture (adapter or script) + InfluxDB persistence
- [ ] 2.3 Add Maxxi measurements to the freshness-healthcheck SLA table
- [ ] 2.4 Extend `solaredge_power.js` hybrid model with the `maxxi_output` term;
      remove the "autarky understated" caveat from ROADMAP
- [ ] 2.5 Dashboard: battery SoC + Maxxi production tiles
- [ ] 2.6 Expose battery states for `deploy-evcc-energy-automation`
