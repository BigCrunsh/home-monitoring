# Tasks

## 1. Export & commit

- [ ] 1.1 Export tool: dump source of all `script.js.common.*` objects to
      `integrations/iobroker/` (one .js per script, name = script name)
- [ ] 1.2 Commit all 14 scripts; reconcile `tankerkoenig_quantiles` vs
      `tankerkoenig_stats.js` naming (keep one, document)
- [ ] 1.3 Bring the Pi repo checkout up to date with master (`git pull`)

## 2. Reconcile drift

- [ ] 2.1 Diff deployed `tibber_states` against the repo version; deploy the repo
      version (includes the `f7f39af` latest-timestamp fix)
- [ ] 2.2 Confirm the `State "cost_last_24h_ts" not found` warnings stop in the
      ioBroker log
- [ ] 2.3 Review the other 12 exported scripts for obviously dead ones (e.g.
      `gardena_valve` if Gardena is retired) and flag, don't delete

## 3. Source-of-truth workflow

- [ ] 3.1 Deploy tool: push a repo script into the ioBroker object DB and restart it
- [ ] 3.2 Drift check command (compare all, report diffs); document running it after
      any ioBroker upgrade
- [ ] 3.3 README for `integrations/iobroker/`: workflow, tool usage, script inventory
