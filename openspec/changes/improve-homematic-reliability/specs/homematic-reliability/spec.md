# homematic-reliability (delta)

## ADDED Requirements

### Requirement: The opener's latency cause is established by measurement
The cause of variable "Öffnen" latency SHALL be established from logged evidence,
not assumption, before any remediation is chosen.

#### Scenario: Actuation latency is quantified
- **WHEN** an open command is issued
- **THEN** the elapsed time from `LOCK_TARGET_LEVEL`→`OPEN` until `LOCK_STATE`/`PROCESS`
  moves is derivable from InfluxDB (62–63 s observed on slow opens)

#### Scenario: Radio congestion is ruled out, not assumed
- **WHEN** a slow open is captured
- **THEN** the central `DUTY_CYCLE_LEVEL` at that moment is checked, and because it was
  low (8–11 %), central-transmit congestion is rejected as the cause and metering-actuator
  throttling is NOT pursued

#### Scenario: Device receiver ruled out via the direct-link remote
- **WHEN** distinguishing a CCU-path delay from a lock-side fault
- **THEN** the evidence that a directly device-linked remote opens instantly is recorded,
  establishing that the lock's receiver, battery and signal are not the bottleneck

### Requirement: A predictable instant-open path is documented
An instant-open path SHALL be documented (the direct-link remote) and the dashboard
SHALL give immediate feedback, since CCU-routed commands to the battery lock are
inherently best-effort.

#### Scenario: Instant path is the direct device link
- **WHEN** an instant open is required
- **THEN** the directly device-linked remote (or an added wall button) is used since it
  bypasses the CCU; the dashboard "Öffnen" is documented as best-effort (~up to 1 min)

#### Scenario: Dashboard gives optimistic feedback
- **WHEN** "Öffnen" is pressed on the dashboard
- **THEN** the button reflects "Öffne …" immediately so a slow CCU path does not read as
  a dead control
