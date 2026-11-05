# Tasks

The former phase B (CCU integration: battery SoC, panel-vs-battery split, control) was
dropped on 2026-11-05: the household's CCU V2 opens no local interface.

- [x] A.1 Meter the Maxxi's AC flow at its socket and verify plausible signed values
      under feeding and charging (done with a Shelly Plug S Gen3 into
      `javascript.0.power_maxxisun`; a HomeMatic plug cannot meter reverse flow)
- [ ] A.2 Verify reporting cadence is acceptable; tune the plug's reporting if too
      coarse
- [x] A.3 Extend `solaredge_power.js`: `maxxi_output` term in the hybrid model
      (`consumption = SE_production + maxxi_output + grid`); stale-handling when the
      plug stops reporting
- [ ] A.4 Persist `maxxi_output` to InfluxDB; add to healthcheck SLAs
- [ ] A.5 Dashboard: "davon Maxxi" value/bar in the Main energy block
- [x] A.6 Remove the "autarky understated" caveat from ROADMAP
