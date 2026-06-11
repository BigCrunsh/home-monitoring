# ci-pipeline Specification

## Purpose
TBD - created by archiving change restore-engineering-hygiene. Update Purpose after archive.
## Requirements
### Requirement: Every push runs the test and lint suite
CI SHALL run tests, lint, and type checks on the supported Python version for every
push and pull request, and report status on the commit.

#### Scenario: Failing test
- **WHEN** a push contains a failing test
- **THEN** the workflow run is red and the commit status reflects the failure

#### Scenario: Type or lint regression
- **WHEN** a push introduces a mypy or ruff violation
- **THEN** the workflow fails even if tests pass

#### Scenario: Green path
- **WHEN** a push passes tests, lint, and type checks on Python 3.12
- **THEN** the workflow is green within the run

