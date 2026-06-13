# homematic-reliability (delta)

## ADDED Requirements

### Requirement: The opener responds within a predictable bound
Actuating the door opener SHALL complete within a predictable, documented time
bound under normal conditions, or the cause of variance SHALL be identified by
measurement and a remediation recommended.

#### Scenario: Central radio duty cycle is measured, not assumed
- **WHEN** the opener latency is investigated
- **THEN** the CCU3 central HmIP `DUTY_CYCLE_LEVEL` and `CARRIER_SENSE_LEVEL` are
  logged to InfluxDB and a slow "Öffnen" is correlated against them, confirming or
  ruling out central-transmit contention as the cause

#### Scenario: Actuation latency is quantified
- **WHEN** an open command is issued
- **THEN** the elapsed time from `LOCK_TARGET_LEVEL`→`OPEN` until `PROCESS`/
  `LOCK_STATE` changes is derivable from logged data, giving a real latency figure
  rather than an impression

#### Scenario: Device side ruled out via the direct-link remote
- **WHEN** distinguishing radio contention from a lock-side fault
- **THEN** the evidence that a directly device-linked remote opens instantly (bypassing
  the CCU) is recorded, establishing that the lock's receiver, battery and RF signal
  are not the bottleneck

### Requirement: RF load on the shared radio is bounded
Background HmIP traffic on the CCU3 radio SHALL be kept low enough that
control commands are not starved of transmit budget.

#### Scenario: Chatty devices are throttled
- **WHEN** central duty cycle is found to spike under normal operation
- **THEN** the continuously-reporting metering actuators are reconfigured to report
  less often (longer interval / larger power delta) and the central duty cycle is
  re-measured to confirm improvement
