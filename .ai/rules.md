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

**TARGET**: No file should exceed 400 lines of code.

**FLEXIBILITY**: 
- Up to 480 lines (120% of target) is acceptable if the file is a logical cohesive unit
- Example: A collection module with 7 similar functions = 540 lines may be acceptable
- Beyond 120%: MUST ask for user approval and present alternatives

**When to split:**
1. ✅ **DO split** if there's a clear logical separation:
   - Different responsibilities (collection vs aggregation)
   - Different concerns (authentication vs profile management)
   - Different time scales (hourly vs monthly operations)

2. ❌ **DON'T split** if:
   - It would create arbitrary divisions
   - It would require excessive cross-file imports
   - It would make function calls less optimal
   - The file is a cohesive unit (e.g., all similar collection functions)

**Decision process:**
1. File > 400 lines → Check if logical split exists
2. Logical split exists → Split immediately
3. No logical split → Check if < 480 lines (120%)
4. If < 480 lines → Keep as single file, document why
5. If > 480 lines → Present alternatives to user for approval

**Example - GOOD split:**
```python
# Before: services/user_service.py (600 lines)
# Clear logical split by responsibility:
services/user/
├── authentication.py  # Login, JWT, password (200 lines)
├── profile.py        # Profile management (200 lines)
└── registration.py   # User registration (200 lines)
```

**Example - BAD split:**
```python
# Before: services/collection.py (540 lines - 7 similar functions)
# Arbitrary split would create:
services/
├── collection_part1.py  # Functions 1-4 (arbitrary)
└── collection_part2.py  # Functions 5-7 (arbitrary)
# Better: Keep as one file since it's cohesive
```

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

## Pre-Commit Requirements (MANDATORY)

**NEVER commit code that:**
1. ❌ Has failing tests
2. ❌ Has linting errors (run `ruff check .`)
3. ❌ Has type errors (run `mypy src/`)

**Pre-commit checklist (MUST run before EVERY commit):**
```bash
# All three must pass before committing
pytest                    # All tests must pass
ruff check .             # No linting errors
mypy src/                # No type errors
```

**If ANY of these fail, you MUST fix them before committing. No exceptions.**

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
- **Don't create files longer than 480 lines (120%)** without logical reason or user approval
- **Don't split files arbitrarily** - only split when there's a clear logical separation
- **Don't suggest large commits** - break into small, atomic commits
- **Don't commit with failing tests** - NEVER, no exceptions
- **Don't commit with linting errors** - NEVER, no exceptions
- **Don't commit with type errors** - NEVER, no exceptions

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