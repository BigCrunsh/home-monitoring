# Tasks

## 1. Unblock (periodic)

- [ ] 1.1 Re-check CCU2 local API availability (maxxisun release notes / community:
      ioBroker.maxxi-charge adapter CCU2 support, HA integrations). Last checked:
      2026-06-10 — CCU2 API in progress, not open. Next check: ~monthly.

## A. Phase A — output metering via HomeMatic plug (no API needed)

- [ ] A.1 Plug the Maxxi feed-in through a free HomeMatic metering plug; verify
      `.6.POWER` reports plausible output under reverse flow (evening battery
      discharge and daytime production)
- [ ] A.2 Verify reporting cadence is acceptable; tune the plug's transmit
      thresholds (delta W / min interval) if too coarse
- [ ] A.3 Extend `solaredge_power.js`: `maxxi_output` term in the hybrid model
      (`consumption = SE_production + maxxi_output + grid`); subscribe to the plug
      state like the Shelly; stale-handling when the plug stops reporting
- [ ] A.4 Persist `maxxi_output` to InfluxDB; add to healthcheck SLAs
- [ ] A.5 Dashboard: "davon Maxxi" value/bar in the Main energy block
- [ ] A.6 Remove the "autarky understated" caveat from ROADMAP (consumption is then
      whole-house-correct; only SoC/split remain for phase B)

## 2. Integrate (once API is open — phase B)

- [ ] 2.1 Design doc: API shape, polling vs push, InfluxDB schema (site tag vs new
      measurements), failure modes
- [ ] 2.2 Implement capture (adapter or script) + InfluxDB persistence
- [ ] 2.3 Add Maxxi measurements to the freshness-healthcheck SLA table
- [ ] 2.4 Extend `solaredge_power.js` hybrid model with the `maxxi_output` term;
      remove the "autarky understated" caveat from ROADMAP
- [ ] 2.5 Dashboard: battery SoC + Maxxi production tiles
- [ ] 2.6 Expose battery states for `deploy-evcc-energy-automation`
