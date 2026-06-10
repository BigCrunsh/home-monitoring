# data-privacy (delta)

## ADDED Requirements

### Requirement: Collected metadata is free of personal address data
The system SHALL sanitize device metadata (names, locations) before storing or
persisting it, so that street addresses and similar personal identifiers never appear
in repository files or InfluxDB tags.

#### Scenario: Device name contains the street address
- **WHEN** the SAM Digital API returns a device named `"G Bornitzstr. 90F"`
- **THEN** the stored device name is a sanitized alias (e.g. `"Gateway"`) and the
  address substring appears nowhere in the persisted output

#### Scenario: Device name without personal data passes through
- **WHEN** the API returns a device named `"Heizkreis 1"`
- **THEN** the name is stored unchanged

#### Scenario: Empty or missing device name
- **WHEN** the API returns a device with an empty or absent name
- **THEN** the mapper stores a stable fallback identifier and does not fail

### Requirement: Repository history contains no personal address data
The repository SHALL contain no occurrences of the home address in any file of any
commit reachable from any ref.

#### Scenario: Full-history scan after rewrite
- **WHEN** all refs are scanned for the address string (e.g. `git log -S` / filter-repo
  analysis)
- **THEN** zero matches are found
