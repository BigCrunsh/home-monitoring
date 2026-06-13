# hourly-forecast (delta)

## ADDED Requirements

### Requirement: The hourly panel shows actionable forecast on a time axis
The hourly forecast panel SHALL present temperature, precipitation probability,
and condition per hour for at least the next 12 hours, with hour labels.

#### Scenario: Rain ahead
- **WHEN** the forecast shows rain probability rising in the evening
- **THEN** the panel shows per-hour rain-probability bars and condition icons on a
  labelled time axis, so the household can see when rain is likely

#### Scenario: No misleading colour
- **WHEN** a value is displayed
- **THEN** its colour encodes its own meaning (temp / rain), not an unrelated
  series

### Requirement: The OWM API key is not stored in the repository
The OpenWeatherMap API key SHALL be read from a non-committed location, not
hardcoded in a tracked file.

#### Scenario: Key absent
- **WHEN** the key state is unset
- **THEN** the script logs a clear error and does not crash, rather than calling
  the API with an empty key silently
