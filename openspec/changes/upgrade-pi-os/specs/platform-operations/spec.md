# platform-operations (delta)

## ADDED Requirements

### Requirement: The OS receives security updates automatically
The host SHALL run a currently supported OS release with unattended security updates
enabled.

#### Scenario: Security patch released
- **WHEN** a security update is published for an installed package
- **THEN** it is installed automatically within the configured window without manual
  action

#### Scenario: Update requires reboot
- **WHEN** an installed update requires a reboot
- **THEN** the need is surfaced (motd/notification) rather than silently deferred
  indefinitely

### Requirement: The system is rebuildable from backups and runbook
A functioning replacement system SHALL be buildable from a blank SD card using only the
repo runbook and the NAS backups.

#### Scenario: Restore drill
- **WHEN** the runbook is executed on fresh media
- **THEN** ioBroker (adapters, scripts, vis project), InfluxDB data, collectors, and
  crontab are restored and fresh data arrives in all active measurements within one
  collection cycle

#### Scenario: Rollback
- **WHEN** the cutover fails
- **THEN** booting the previous SD card restores the prior system unchanged
