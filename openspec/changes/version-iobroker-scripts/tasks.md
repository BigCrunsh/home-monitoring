# Tasks

## 1. Export & commit

- [x] 1.1 Export tool: dump source of all `script.js.common.*` objects to
      `integrations/iobroker/` (`tools/export_scripts.sh`)
- [x] 1.2 Commit all deployed scripts (12 leaf scripts); naming reconciled by
      renaming repo `tankerkoenig_stats.js` → `tankerkoenig_quantiles.js` to match
      the deployed object id (contents were identical)
- [x] 1.3 Pi checkout synced: remote switched to HTTPS (the old `git@github.com`
      key was dead; public repo needs no pull credentials); `git pull --ff-only`
      now part of the deploy cycle. End-to-end `check_drift.sh` on the Pi: zero
      drift. Bonus beyond original scope: vis-2 layout is also versioned now
      (`vis/main/` + export_vis.sh/deploy_vis.sh)

## 2. Reconcile drift

- [x] 2.1 Verified: deployed `tibber_states` is byte-identical to the repo — the
      "outdated deployment" hypothesis was wrong. The `State "cost_last_24h_ts" not
      found` warnings are an in-script bug (setState before createState completes,
      same race fixed in `solaredge_power.js`) — flagged as a separate small fix,
      not a drift issue
- [x] 2.2 (Reframed by 2.1 — warnings need the race fix, not a redeploy)
- [x] 2.3 Reviewed all 12: `gardena_valve` and `netatmo_wind` are idle (no source
      data); flagged in the README inventory, not deleted pending the Gardena
      decision

## 3. Source-of-truth workflow

- [x] 3.1 Deploy tool: `tools/deploy_script.sh` (updates source; creates missing
      script objects disabled for review)
- [x] 3.2 Drift check: `tools/check_drift.sh`; verified zero drift across all 12
      scripts (2026-06-10); documented to run after ioBroker upgrades
- [x] 3.3 README for `integrations/iobroker/`: workflow, tool usage, script inventory
