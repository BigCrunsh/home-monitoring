# Tasks

## 1. Preparation

- [x] 1.1 Verify backups are current & complete: backitup (ioBroker), InfluxDB volume,
      `.env`, crontab, `/home/pi/logs` layout (2026-11-08: all current — backitup daily
      02:40, portable InfluxDB backup 02:15, NAS pulls the whole `/` daily with 14 snapshots.
      Gaps: `/boot` excluded from the NAS pull, one InfluxDB generation only, no off-site
      copy; the runbook's step 0 covers `/boot`)
- [x] 1.2 Decide Python delivery on the new OS (distro 3.12 vs uv/pyenv); record in
      design.md (uv-managed Python 3.12 + `.venv` from pyproject.toml)
- [x] 1.3 Write the rebuild runbook draft from the current system's inventory
      (`runbook.md`)

## 2. Build the new system (old card untouched)

- [ ] 2.1 Flash 64-bit current Raspberry Pi OS to new media; base setup (ssh keys,
      hostname, docker)
- [ ] 2.2 Restore ioBroker from backitup; verify adapters, scripts, vis project
- [ ] 2.3 Restore InfluxDB volume; verify history queryable
- [ ] 2.4 Install collectors (repo clone, venv, .env, crontab); verify one cycle of
      fresh data for every active measurement
- [ ] 2.5 Enable unattended-upgrades + reboot notification

## 3. Cutover & verify

- [ ] 3.1 Swap media; confirm dashboard, healthcheck, and all collectors green for 24 h
- [ ] 3.2 Keep the old card for 2 weeks as rollback; then wipe
- [ ] 3.3 Finalize the runbook with everything learned; commit
