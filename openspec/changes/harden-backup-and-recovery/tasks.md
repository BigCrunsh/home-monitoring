# Tasks

## 1. Backup-freshness monitoring (finding #5) — DONE

- [x] 1.1 Healthcheck backup-age check: newest `/opt/iobroker/backups/*.tar.gz`
      and the `/home/pi/.last_nas_backup_success` marker, SLAs in conf (26 h each)
- [x] 1.2 Telegram alert + recovery notice (reuses notifier/dedup); 4 tests.
      Deployed + verified live on the Pi (both backups evaluated fresh, sent=0)
- [ ] 1.3 Dashboard tile "Letztes Backup" — DEFERRED (Telegram alerting already
      delivers the visibility; tile is nice-to-have, needs a state-export path)

## 2. Consistent DB dump + improved backup script (#2, #3, #7) — DONE

- [x] 2.1 `influx_backup.sh` (portable `influxd backup`, atomic swap under
      /home/pi); Pi cron 03:30 (before the 04:00 pull); run live → 8.4 MB, 63 files
- [x] 2.2 `backup_pi.sh` rewritten: `--link-dest` incrementals, 14 dated
      snapshots + `latest` symlink, atomic `.partial`, success-marker touch-back,
      `chmod 0750`
- [x] 2.3 Deployed: Pi influx cron added; new backup_pi.sh on the NAS (old saved
      as `.orig-20260611`). Validated by rsync dry-run from the NAS (exit 0:
      connection + sudo rsync-path + exclude + link-dest) and marker-SSH ok. First
      real run = tonight's 04:00 scheduled job, monitored; old `raspberrypi.{1,2,3}`
      retained as rollback

## 3. Recovery test (#1) — DONE

- [x] 3.1 Restore drill executed: portable dump restored into a throwaway
      `influxdb:1.8` container → `electricity_prices_euro` returned 288 rows (24 h),
      **matching the live DB** — consistency + recoverability proven
- [x] 3.2 Restore procedure documented in the README backup section; feeds the
      upgrade-pi-os runbook

## 4. User actions (DSM UI — cannot automate)

- [ ] 4.1 Configure an offsite copy of `/volume1/rpi_backup` (#4): HyperBackup to
      cloud, or CloudSync the folder. **User action.**
- [ ] 4.2 NAS patching/reboot (#6): note — DS214play is **EOL** (stuck on DSM 6,
      no DSM 7), so "patch" is limited to available DSM 6 updates + an occasional
      reboot (441-day uptime). Longer term: replace the NAS. **User action.**

## 5. Documentation — DONE

- [x] 5.1 README backup & recovery section: both mechanisms, the consistent dump,
      freshness alerting, the verified restore procedure, and the known 3-2-1 / EOL
      gaps
