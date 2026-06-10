# Version-control all ioBroker JavaScript scripts

## Why

14 JavaScript scripts run in production in ioBroker; only 2 exist in the repo, and one
of those has drifted (the deployed `tibber_states` predates the repo fix `f7f39af` and
throws `State not found` warnings). The logic that drives the dashboard lives solely in
ioBroker's object DB on a single SD card — the project's largest bus-factor risk.

## What Changes

- Export all deployed scripts (`script.js.common.*`) into `integrations/iobroker/` and
  commit them.
- Reconcile drift: deploy the repo versions (including the `f7f39af` timestamp fix) back
  to ioBroker; bring the Pi's repo checkout up to date with master.
- Establish a documented deploy-from-git procedure (export/import tooling) so the repo
  is the source of truth.
- Add a drift check that compares deployed scripts against the repo and reports
  differences.

## Capabilities

### New Capabilities
- `iobroker-script-management`: repo as source of truth for deployed ioBroker scripts.

### Modified Capabilities
- (none)

## Impact

- `integrations/iobroker/` (12 new scripts, 2 updated), new export/deploy tooling.
- ioBroker javascript adapter on the Pi (scripts updated in place).
- Naming reconciliation: deployed `tankerkoenig_quantiles` vs repo `tankerkoenig_stats.js`.
