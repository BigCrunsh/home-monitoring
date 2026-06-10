# Upgrade the Pi to a current 64-bit OS with automatic security updates

## Why

The Pi runs 32-bit Raspbian 11 with a March-2022 kernel, 199 days of uptime, and no
update mechanism — ~4 years of unpatched system software under a host that maintains a
public DNS name. The single SD card also holds the only live copy of the ioBroker
config; the upgrade path doubles as the first real restore test of the NAS backup.

## What Changes

- Fresh 64-bit Raspberry Pi OS (current stable) on a **new** SD card (or SSD), keeping
  the old card untouched as instant rollback.
- Restore services from backup onto the new card: ioBroker (backitup), InfluxDB docker
  volume, Python env, crontab, .env — this *is* the restore drill.
- `unattended-upgrades` for automatic security patches; documented monthly reboot or
  patch routine.
- A rebuild runbook in the repo: from blank SD to fully working system.

## Capabilities

### New Capabilities
- `platform-operations`: OS currency and rebuildability requirements.

### Modified Capabilities
- (none)

## Impact

- Whole-system cutover (a few hours of monitoring downtime; data gap acceptable).
- Python 3.12 must be available/buildable on the new OS (or ship via uv/pyenv —
  decided in design).
- All service configs touched; do **after** `harden-network-services` so credentials
  are restored, not re-invented.
