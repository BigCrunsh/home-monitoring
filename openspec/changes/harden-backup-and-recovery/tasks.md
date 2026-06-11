# Tasks

## 1. Backup-freshness monitoring (finding #5) — autonomous

- [ ] 1.1 Extend the healthcheck with a backup-age check: newest
      `/opt/iobroker/backups/*.tar.gz` and a NAS-pull success marker
      (`/home/pi/.last_nas_backup_success`), each with an SLA in conf
- [ ] 1.2 Telegram alert on staleness + recovery notice (reuse the existing
      notifier/dedup); tests 2:1 unhappy:happy
- [ ] 1.3 Dashboard tile "Letztes Backup: vor N …" on the Energy/Advanced view

## 2. Consistent DB dump + improved backup script (#2, #3, #7)

- [ ] 2.1 Pi-side nightly `influxd backup` (portable) to a local dir before the NAS
      pull (docker exec); script + cron, logged
- [ ] 2.2 Rewrite `deps/general/bin/backup_pi.sh`: `--link-dest` hardlink
      incrementals, ≥14 generations, success-marker touched back on the Pi,
      tightened backup-dir permissions
- [ ] 2.3 Deploy: Pi cron (influx dump) + copy backup_pi.sh to
      `/volume1/rpi_backup/scripts/` on the NAS (user-approved writes)

## 3. Recovery test (#1)

- [ ] 3.1 Partial restore drill now: load the influx dump into a throwaway
      `influxdb:1.8` container and confirm it is queryable (proves consistency +
      recoverability)
- [ ] 3.2 Document the full restore procedure (fresh OS → restore ioBroker archive,
      influx dump, collectors, crontab) — folds into the upgrade-pi-os runbook

## 4. User actions (DSM UI — cannot automate)

- [ ] 4.1 Configure an offsite copy of `/volume1/rpi_backup` (#4): HyperBackup to
      cloud, or CloudSync the folder — documented steps
- [ ] 4.2 Patch + reboot the NAS (#6): DSM update; verify RAID healthy after

## 5. Documentation

- [ ] 5.1 README backup section: the two mechanisms, the freshness alerting, the
      restore procedure, and the 3-2-1 status
