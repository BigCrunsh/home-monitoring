# backup-recovery (delta)

## ADDED Requirements

### Requirement: Backup staleness is alerted
The system SHALL alert via Telegram when a backup has not completed within its
freshness window, covering both the ioBroker application backup and the NAS
filesystem pull.

#### Scenario: NAS pull stops succeeding
- **WHEN** the NAS-pull success marker is older than its SLA (e.g. 26 h)
- **THEN** a Telegram alert names the backup and its age within one check interval

#### Scenario: ioBroker backup stops being produced
- **WHEN** the newest ioBroker `backitup` archive is older than its SLA
- **THEN** a Telegram alert is sent

#### Scenario: Both backups fresh
- **WHEN** both the ioBroker archive and the NAS marker are within their SLAs
- **THEN** no alert is sent

### Requirement: The database is backed up consistently
The InfluxDB backup SHALL be a consistent snapshot, not a copy of live data files
taken while the database is being written.

#### Scenario: Nightly consistent dump
- **WHEN** the nightly backup runs
- **THEN** a consistent InfluxDB dump (portable `influxd backup`) is produced before
  the NAS pull and is included in the captured set

#### Scenario: Dump failure is visible
- **WHEN** the InfluxDB dump fails
- **THEN** it is logged with a non-zero result and surfaced by the freshness
  monitoring rather than silently producing a stale dump

### Requirement: Backup retention exceeds a few days
The backup SHALL retain enough history that data corruption or deletion can be
recovered from beyond a 3-day window.

#### Scenario: Retention depth
- **WHEN** the retention policy is applied
- **THEN** at least 14 daily generations are available, implemented space-efficiently
  (e.g. `--link-dest` hardlink incrementals)

### Requirement: Recovery is tested, not assumed
A restore SHALL be verified to actually reconstruct working state, not merely to
produce files on the NAS.

#### Scenario: Restore drill
- **WHEN** the documented restore procedure is run against a throwaway target
- **THEN** the InfluxDB dump loads and is queryable, and the ioBroker archive
  restores, confirming the backup is recoverable

#### Scenario: Offsite copy exists
- **WHEN** the backup set is reviewed for the 3-2-1 rule
- **THEN** at least one copy is offsite (or the absence is explicitly accepted and
  documented), so a single-site loss does not destroy all copies
