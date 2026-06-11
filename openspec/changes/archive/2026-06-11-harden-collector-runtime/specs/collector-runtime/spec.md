# collector-runtime (delta)

## ADDED Requirements

### Requirement: External API calls are time-bounded and retried
Every collector SHALL bound external HTTP calls with a timeout and retry transient
failures with exponential backoff before failing the run.

#### Scenario: API hangs
- **WHEN** a vendor API does not respond
- **THEN** the collector fails within its timeout budget (≤ 60 s total) with a logged
  structured error and non-zero exit code

#### Scenario: Transient failure recovers
- **WHEN** an API call fails once with a 5xx/network error and succeeds on retry
- **THEN** the run completes successfully and logs the retry

### Requirement: Collector runs do not overlap
The scheduler wrapper SHALL prevent two concurrent runs of the same collector.

#### Scenario: Previous run still active
- **WHEN** cron fires while the previous run of the same collector holds the lock
- **THEN** the new invocation exits immediately with a logged skip, without touching
  the data

### Requirement: Failures are reported structurally
All collector scripts SHALL report errors via structured logging (machine-parseable),
not bare stdout/stderr prints.

#### Scenario: Collector raises
- **WHEN** any collector fails for any reason
- **THEN** the log line includes timestamp, collector name, error type, and message in
  the structured format
