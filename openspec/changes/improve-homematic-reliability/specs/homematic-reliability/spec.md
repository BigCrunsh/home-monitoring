# homematic-reliability (delta)

## ADDED Requirements

### Requirement: The opener responds within a predictable bound
Actuating the door opener SHALL complete within a predictable, documented time
bound under normal conditions, or the cause of variance SHALL be identified and a
remediation recommended.

#### Scenario: Duty-cycle saturation identified
- **WHEN** the opener latency is investigated
- **THEN** the BidCoS-RF duty cycle is measured and either ruled out or confirmed as
  the cause, with a concrete remediation (reduce RF load / improve signal / replace)

#### Scenario: Battery and signal ruled in or out
- **WHEN** diagnosing reliability
- **THEN** KeyMatic battery and RF signal/RSSI are checked and recorded, so the fix
  targets the real bottleneck rather than guessing
