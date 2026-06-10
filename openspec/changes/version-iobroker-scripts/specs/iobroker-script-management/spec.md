# iobroker-script-management (delta)

## ADDED Requirements

### Requirement: Every deployed script exists in the repository
Every enabled ioBroker JavaScript script SHALL have an identical counterpart in
`integrations/iobroker/`.

#### Scenario: Drift check on a clean state
- **WHEN** the drift check compares all deployed `script.js.common.*` sources with the
  repo files
- **THEN** it reports zero differences

#### Scenario: Script edited directly in ioBroker
- **WHEN** a script is changed in the ioBroker admin UI without a repo commit
- **THEN** the next drift check lists that script as diverged

### Requirement: Deployment flows from the repository to ioBroker
Script changes SHALL be made in the repo and deployed with the documented procedure,
not edited in production first.

#### Scenario: Deploying a fixed script
- **WHEN** the deploy procedure is run for a script changed in the repo
- **THEN** the deployed source matches the repo and the script is restarted

#### Scenario: Deploy of a script that does not exist in ioBroker
- **WHEN** the deploy procedure encounters a repo script with no deployed counterpart
- **THEN** it creates the script object rather than failing silently
