# project-docs (delta)

## ADDED Requirements

### Requirement: Project documentation reflects the actual system
Project documentation SHALL describe the system as deployed, with no references to
frameworks or components that do not exist in the repo. This covers `.ai/context.md`,
the README architecture/scheduling sections, and the measurements documentation.

#### Scenario: AI-assistant context file
- **WHEN** `.ai/context.md` is read
- **THEN** it describes cron-driven Python collectors writing to InfluxDB 1.8 with an
  ioBroker/vis-2 consumer — and contains no FastAPI/PostgreSQL/SQLAlchemy template
  content

#### Scenario: Measurement docs vs live schema
- **WHEN** the documented measurement list is compared with `SHOW MEASUREMENTS` on the
  live database
- **THEN** every live measurement is documented and disabled sources (Techem, Gardena)
  are marked as such

#### Scenario: Dependency install instructions
- **WHEN** a contributor follows the documented install steps on a clean machine
- **THEN** a single dependency source (`pyproject.toml`) is used and `make test` passes
