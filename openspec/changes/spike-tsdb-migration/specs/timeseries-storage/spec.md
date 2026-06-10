# timeseries-storage (delta)

## ADDED Requirements

### Requirement: Storage backend satisfies all existing consumers
Any storage backend (current or future) SHALL support the system's consumers: the
Python collectors' write path, the ioBroker integration's query path, and Grafana
dashboards.

#### Scenario: Candidate lacks an ioBroker query path
- **WHEN** an evaluated backend cannot serve the queries used by the deployed ioBroker
  scripts (directly or via a documented adapter change)
- **THEN** it is disqualified or the required script changes are costed explicitly in
  the decision document

#### Scenario: Candidate lacks a maintained Python client
- **WHEN** an evaluated backend has no maintained async Python write client
- **THEN** the repository-layer rework is costed explicitly in the decision document

### Requirement: Historical data survives migration
A migration SHALL carry over the existing measurement history without loss of
measurements, fields, tags, or timestamps.

#### Scenario: Dry-run verification
- **WHEN** a sample dataset (≥ 1 month, all measurements) is migrated in the dry-run
- **THEN** row counts and spot-checked values match the source for every measurement

### Requirement: Decision is recorded with evidence
The spike SHALL produce a written recommendation comparing all candidates against the
constraint list, including the do-nothing option.

#### Scenario: Spike concludes
- **WHEN** the evaluation finishes
- **THEN** design.md contains the comparison matrix, the recommendation, and the scope
  outline for the follow-up migration change (or the rationale for staying on 1.8)
