# Tasks

The former phase B (CCU integration: battery SoC, panel-vs-battery split, control) was
dropped on 2026-11-05: the household's CCU V2 opens no local interface.

- [x] A.1 Meter the Maxxi's AC flow at its socket and verify plausible signed values
      under feeding and charging (done with a Shelly Plug S Gen3 into
      `javascript.0.power_maxxisun`; a HomeMatic plug cannot meter reverse flow)
- [x] A.2 Verify reporting cadence is acceptable; tune the plug's reporting if too
      coarse (measured 2026-11-06: every 7-13 s while feeding; idle reports stay within
      the energy script's 2-min freshness limit all night. No tuning needed)
- [x] A.3 Extend `solaredge_power.js`: `maxxi_output` term in the hybrid model
      (`consumption = SE_production + maxxi_output + grid`); stale-handling when the
      plug stops reporting
- [x] A.4 Persist `maxxi_output` to InfluxDB; add a freshness alert (persisted since
      2026-10-31; the energy totals carry a `Maxxisun` field. The alert lives in Diagnose,
      not the healthcheck: a dead plug leaves power_maxxisun at a fresh 0 W, so Diagnose
      watches the plug's own MQTT report: silent 15 min = Geräte issue + Telegram)
- [x] A.5 Dashboard: "davon Maxxi" value/bar in the Main energy block (the Overview's
      Energie block has a separate Maxxisun row with its own bar, `main_v2.js` since 8bad3a8)
- [x] A.6 Remove the "autarky understated" caveat from ROADMAP
