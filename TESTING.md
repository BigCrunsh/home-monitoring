# Testing Guide

## Running Tests

### Unit Tests (No External Dependencies)

Run all unit tests:
```bash
pytest tests/unit/ -v
```

Run specific test file:
```bash
pytest tests/unit/services/tibber/test_tibber_service.py -v
```

### Integration Tests (Require External Services)

Integration tests require a running InfluxDB instance. These tests are marked with `@pytest.mark.integration`.

**Skip integration tests** (default for CI/CD):
```bash
pytest -m "not integration"
```

**Run only integration tests**:
```bash
pytest -m integration
```

**Run all tests** (unit + integration):
```bash
pytest
```

### Integration Test Setup

The IOBroker integration tests require:
1. **InfluxDB** running on `localhost:8086` (or configured via environment variables)
2. **Test data** populated in InfluxDB from previous Tibber service runs

To set up InfluxDB for integration tests:
```bash
# Using Docker
docker run -d -p 8086:8086 \
  -e INFLUXDB_DB=home_monitoring \
  -e INFLUXDB_ADMIN_USER=admin \
  -e INFLUXDB_ADMIN_PASSWORD=admin \
  --name influxdb \
  influxdb:1.8

# Configure environment
export INFLUXDB_HOST=localhost
export INFLUXDB_PORT=8086
export INFLUXDB_DATABASE=home_monitoring
export INFLUXDB_USERNAME=admin
export INFLUXDB_PASSWORD=admin
```

## Pre-Commit Checks

Before committing, **ALWAYS** run:
```bash
pytest tests/unit/        # All unit tests must pass
ruff check .              # No linting errors
mypy src/                 # Type checking (37 warnings acceptable)
```

## Test Coverage

Run tests with coverage:
```bash
pytest --cov=src/home_monitoring --cov-report=html tests/unit/
```

View coverage report:
```bash
open htmlcov/index.html
```

## Test Structure

```
tests/
├── unit/                 # Unit tests (no external dependencies)
│   ├── services/        # Service layer tests
│   └── ...
├── integration/         # Integration tests (require InfluxDB)
│   ├── test_iobroker_integration.py
│   └── test_iobroker_timestamps.py
└── conftest.py          # Shared fixtures
```

## Testing Philosophy

- **1 Happy Path : 2+ Unhappy Paths** - For every happy path test, write at least 2 unhappy path tests
- **Unit tests** - Fast, isolated, no external dependencies
- **Integration tests** - Verify end-to-end functionality with real services
