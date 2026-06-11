# Harden backup & recovery

## Why

A 2026-06-11 audit of the backup chain (Pi + Synology DS214play) found the daily
NAS rsync pull works and captures everything (rootfs, `/opt/iobroker`, `.env`, and
the 180 MB InfluxDB volume) onto a RAID1 mirror — better than feared. But it has
real, mostly-silent weaknesses:

1. **Never recovery-tested** — files existing ≠ restorable; the rsync is not a
   bootable image.
2. **Hot-copy of a live InfluxDB** — TSM/WAL files copied while the DB is written
   every 5 min can restore inconsistent/corrupt.
3. **Only 3 days of history** — bad data / deletion / ransomware not caught within
   3 days is gone from the backup too.
4. **No verified offsite** — both copies (Pi + NAS) are in one house (3-2-1 gap).
5. **No failure alerting** — if rsync starts failing, the rotations silently freeze
   (the same silent-failure class as the dead rain gauge).
6. **The NAS is aging/unpatched** — DSM kernel 3.2.40, 441-day uptime, EOL hardware.
7. **Minor** — world-writable backup dirs; full 18 GB copy nightly (no `--link-dest`).

## What Changes

- **Backup-freshness monitoring** (closes #5): the existing hourly healthcheck also
  checks the age of the newest ioBroker `backitup` archive and a NAS-pull success
  marker, alerting via Telegram when either is stale. Plus a dashboard tile.
- **Improved `backup_pi.sh`** (closes #2, #3, #7): `--link-dest` hardlink
  incrementals (deeper retention at near-zero extra space), a consistent InfluxDB
  dump instead of a live file copy, a success-marker touched back on the Pi, and
  tightened permissions.
- **Consistent InfluxDB dump** (#2): a Pi-side nightly `influxd backup` (portable)
  before the NAS pull, so the rsync captures a consistent snapshot.
- **Recovery test + runbook** (#1): a documented, scripted restore drill; a partial
  restore executed now to prove the influx backup is loadable.
- **Documented user actions** (#4, #6): configure an offsite copy
  (HyperBackup/CloudSync) and patch/reboot the NAS — DSM-UI steps we cannot do
  over SSH.

## Capabilities

### New Capabilities
- `backup-recovery`: requirements for backup freshness, consistency, retention,
  alerting, and tested recoverability.

### Modified Capabilities
- (none; the healthcheck gains backup checks but the monitoring-healthcheck spec's
  existing requirements are unchanged)

## Impact

- `deps/general/bin/backup_pi.sh` (deployed to the NAS by copying to
  `/volume1/rpi_backup/scripts/`), a new Pi-side influx-dump script + cron, the
  healthcheck service + `conf/healthcheck.json`, a dashboard tile, README/runbook.
- User actions on the Synology (offsite, patching) are out of scope for automation
  and listed as tasks.
