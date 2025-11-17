# AI Assistant Rules for This Project

## Python Version & Environment
- Python 3.11+ (use modern syntax)
- Use `uv` for dependency management (preferred) or `pip` with `requirements.txt`
- Virtual environment required for all development

## Code Style & Formatting
- Follow PEP 8 with line length of 88 characters (Black default)
- Use Black for formatting
- Use Ruff for linting (replaces flake8, isort, pylint)
- Type hints required for all function signatures
- Use modern Python features (match/case, structural pattern matching, type unions with `|`)

## Type Hints & Static Analysis
```python
# Good - use modern type hints
def process_data(items: list[dict[str, int]]) -> dict[str, int]:
    ...

# Avoid - old-style typing
from typing import List, Dict
def process_data(items: List[Dict[str, int]]) -> Dict[str, int]:
    ...
```
- Use `mypy` in strict mode
- Prefer built-in generics over `typing` module (Python 3.9+)
- Use `Protocol` for structural subtyping

## Code Organization
```
src/
├── __init__.py
├── core/           # Core business logic
├── models/         # Data models, schemas
├── services/       # Business services
├── api/            # API routes/endpoints
├── utils/          # Utility functions
└── config.py       # Configuration management

tests/
├── unit/
├── integration/
└── conftest.py     # Pytest fixtures
```

## File Size Limit
**CRITICAL**: No file should exceed 400 lines of code.

When a file approaches 400 lines:
- Split into multiple files by responsibility
- Extract related functions into separate modules
- Break large classes into smaller, focused classes
- Use composition over inheritance
- Create sub-packages for related functionality

Example splits:
- `services/user_service.py` (450 lines) → Split into:
  - `services/user/auth.py` - Authentication logic
  - `services/user/profile.py` - Profile management
  - `services/user/registration.py` - Registration flow
- `models/order.py` (500 lines) → Split into:
  - `models/order/order.py` - Core order model
  - `models/order/items.py` - Order items model
  - `models/order/payment.py` - Payment-related models

## Testing
- Use `pytest` for all tests
- Minimum 80% code coverage for new code
- Test file naming: `test_*.py` or `*_test.py`
- Use fixtures for setup/teardown
- Mock external dependencies with `pytest-mock` or `unittest.mock`
- Use `pytest-asyncio` for async code
- **CRITICAL**: For every happy path test case, write at least 2 unhappy path test cases
  - Test edge cases, invalid inputs, missing data, permission errors
  - Unhappy paths are where most bugs hide
  - Example: If testing `create_user()` success, also test duplicate email + invalid email format

## Async/Await
- Use `async`/`await` for I/O operations
- Prefer `asyncio` over threading for concurrency
- Use `httpx` for async HTTP requests (not `requests`)
- Use `asyncpg` for PostgreSQL, `motor` for MongoDB

## Error Handling
```python
# Prefer specific exceptions
class DataValidationError(ValueError):
    """Raised when data validation fails."""
    pass

# Use structured error handling
def process(data: dict[str, Any]) -> Result:
    try:
        validated = validate(data)
    except ValidationError as e:
        logger.error(f"Validation failed: {e}")
        raise DataValidationError(str(e)) from e
```
- Create custom exception classes for domain-specific errors
- Always log errors with context
- Never use bare `except:` clauses

## Logging
- Use `structlog` for structured logging (preferred) or standard `logging`
- Include context in all log messages
- Log levels: DEBUG for development, INFO for important events, ERROR for failures
```python
import structlog
logger = structlog.get_logger()
logger.info("processing_started", user_id=user_id, item_count=len(items))
```

## Dependencies
- Specify exact versions in production (`==`)
- Use version ranges for libraries (`>=`, `<`)
- Group dependencies logically:
  - Core dependencies
  - Dev dependencies
  - Testing dependencies
- Document why non-obvious dependencies are needed

## Data Validation
- Use `pydantic` v2 for data validation and settings
- Use `pydantic.BaseModel` for all data structures
- Validate at boundaries (API inputs, external data)
```python
from pydantic import BaseModel, Field, field_validator

class UserCreate(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    age: int = Field(..., ge=0, le=150)
```

## Configuration
- Use `pydantic-settings` for configuration management
- Environment variables for secrets and environment-specific config
- Never commit secrets to version control
- Use `.env` files locally (gitignored)

## Database
- Use SQLAlchemy 2.0+ with async support
- Use Alembic for migrations
- Never use raw SQL strings - use ORM or query builder
- Include indexes in model definitions

## API Development
- Use FastAPI for REST APIs
- Use dependency injection for services
- Validate all inputs with Pydantic models
- Return proper HTTP status codes
- Include OpenAPI documentation

## Documentation
- Docstrings required for all public functions/classes (Google or NumPy style)
- Include type information and examples
```python
def calculate_metrics(data: pd.DataFrame) -> dict[str, float]:
    """Calculate key metrics from input data.
    
    Args:
        data: DataFrame containing columns 'value' and 'timestamp'
        
    Returns:
        Dictionary with metrics 'mean', 'std', 'count'
        
    Raises:
        ValueError: If required columns are missing
    """
```

## Git & Commits
- **ALWAYS suggest small, atomic commits** following Continuous Delivery practices
- Each commit = one logical change that could be deployed independently
- **ALWAYS run before committing**: `pytest && ruff check . && mypy src/`
- Use conventional commit format: `type(scope): subject`
- If suggesting code changes, break them into multiple commit suggestions
- See `.ai/git-workflow.md` for complete Git best practices

## Don't Do This
- Don't use `import *`
- Don't use mutable default arguments
- Don't ignore type checker warnings
- Don't use `os.path` - use `pathlib.Path`
- Don't use `datetime.datetime.now()` without timezone
- Don't concatenate paths with strings - use `Path` objects
- Don't use `print()` for logging
- Don't commit commented-out code
- Don't use global variables for state
- Don't use `requirements.txt` if using `pyproject.toml`
- **Don't create files longer than 400 lines** - split them up instead
- **Don't suggest large commits** - break into small, atomic commits
- **Don't commit without running tests and linters**

## Security
- Sanitize all user inputs
- Use parameterized queries (ORM handles this)
- Never log sensitive data (passwords, tokens, PII)
- Use environment variables for secrets
- Keep dependencies updated (use `pip-audit` or `safety`)

## Performance
- Profile before optimizing
- Use generators for large datasets
- Consider `numpy`/`pandas` for numerical operations
- Use connection pooling for databases
- Cache expensive operations appropriately