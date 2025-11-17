# Project Context & Architecture

## Tech Stack
- **Python**: 3.12.3
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy 2.0 (async)
- **Validation**: Pydantic v2
- **Testing**: pytest, pytest-asyncio, pytest-mock
- **Linting/Formatting**: Ruff, Black, mypy
- **Logging**: structlog
- **Dependency Management**: uv (or pip with pyproject.toml)

## Project Structure
```
project/
├── .ai/                    # AI assistant configuration
│   ├── rules.md           # Main rules
│   ├── patterns.md        # Code patterns
│   ├── examples.md        # Reference examples
│   └── context.md         # This file
├── src/
│   ├── __init__.py
│   ├── main.py            # FastAPI app entry point
│   ├── config.py          # Configuration management
│   ├── dependencies.py    # Dependency injection
│   ├── core/              # Core business logic
│   │   ├── __init__.py
│   │   ├── security.py    # Auth, JWT, passwords
│   │   └── exceptions.py  # Custom exceptions
│   ├── models/            # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── base.py        # Base model class
│   │   └── user.py        # User model
│   ├── schemas/           # Pydantic schemas
│   │   ├── __init__.py
│   │   └── user.py        # User schemas
│   ├── repositories/      # Data access layer
│   │   ├── __init__.py
│   │   └── user.py        # User repository
│   ├── services/          # Business logic layer
│   │   ├── __init__.py
│   │   └── user.py        # User service
│   │   # If user.py exceeds 400 lines, split into:
│   │   # └── user/
│   │   #     ├── __init__.py
│   │   #     ├── auth.py
│   │   #     ├── profile.py
│   │   #     └── registration.py
│   ├── api/               # API routes
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   └── users.py   # User endpoints
│   │   │   # If users.py exceeds 400 lines, split by concern
│   │   └── deps.py        # Route dependencies
│   └── utils/             # Utility functions
│       ├── __init__.py
│       └── datetime.py    # Date/time helpers
├── tests/
│   ├── __init__.py
│   ├── conftest.py        # Pytest fixtures
│   ├── unit/              # Unit tests
│   │   ├── test_services.py
│   │   └── test_repositories.py
│   │   # If test files exceed 400 lines, split into subdirectories
│   └── integration/       # Integration tests
│       └── test_api.py
├── alembic/               # Database migrations
│   ├── versions/
│   └── env.py
├── .env.example           # Environment variables template
├── pyproject.toml         # Project configuration
├── README.md
└── docker-compose.yml     # Local development setup
```

**File Size Policy**: No file should exceed 400 lines. When approaching this limit, refactor into a package structure.

## Key Architectural Decisions

### Layered Architecture
We use a clean architecture with clear separation of concerns:
1. **API Layer** (`api/`): HTTP endpoints, request/response handling
2. **Service Layer** (`services/`): Business logic, orchestration
3. **Repository Layer** (`repositories/`): Data access, database queries
4. **Model Layer** (`models/`): Database models, domain entities

### Dependency Injection
- Use FastAPI's `Depends()` for dependency injection
- Define dependencies in `dependencies.py` and `api/deps.py`
- Makes testing easier with mock injection

### Async-First
- All I/O operations are async (database, HTTP calls, file I/O)
- Use `AsyncSession` for database operations
- Use `httpx` for HTTP requests, not `requests`

### Type Safety
- Strict type checking with mypy
- Type hints required for all function signatures
- Use Pydantic for runtime validation at API boundaries

## Database Patterns

### Models
- SQLAlchemy 2.0 style with `Mapped` types
- Include `created_at` and `updated_at` timestamps
- Use proper indexes for query performance

### Migrations
- Alembic for all schema changes
- Never modify database directly
- Name migrations descriptively: `YYYY_MM_DD_HHMM_description`

### Queries
- Use async SQLAlchemy queries
- Prefer explicit selects over lazy loading
- Use `joinedload()` or `selectinload()` for relationships

## API Design

### Versioning
- API versioned under `/api/v1/`
- Breaking changes require new version

### Response Format
- Use Pydantic models for responses
- Include proper HTTP status codes
- Errors follow `ErrorResponse` schema (see examples.md)

### Authentication
- JWT-based authentication
- Include `Authorization: Bearer <token>` header
- Use `get_current_user` dependency for protected routes

## Testing Strategy

### Test Ratio: 1 Happy : 2+ Unhappy
**MANDATORY**: For every happy path test case, write at least 2 unhappy path test cases.

Unhappy paths to consider:
- Invalid inputs (format, range, type)
- Missing required data
- Resource not found
- Resource already exists (duplicates)
- Permission/authorization failures
- External service failures
- Business rule violations
- Edge cases and boundary conditions

### Unit Tests
- Test services and repositories in isolation
- Use mocks for external dependencies
- Fast execution (no database)
- Follow 1:2+ happy:unhappy ratio

### Integration Tests
- Test full request/response cycle
- Use in-memory SQLite or test database
- Test authentication flows
- Follow 1:2+ happy:unhappy ratio

### Coverage
- Minimum 80% coverage for new code
- Focus on business logic and critical paths
- Unhappy paths often reveal the most bugs

## Configuration

### Environment Variables
Required:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `ENVIRONMENT`: `development` | `staging` | `production`

Optional:
- `LOG_LEVEL`: Logging level (default: `INFO`)
- `CORS_ORIGINS`: Allowed CORS origins
- `REDIS_URL`: Redis connection for caching

### Settings Management
- Use `pydantic-settings` for configuration
- Never commit `.env` file
- Use `.env.example` as template

## Common Workflows

### Adding a New Feature
1. Create database model in `models/`
2. Create Alembic migration
3. Create Pydantic schemas in `schemas/`
4. Implement repository in `repositories/`
5. Implement service in `services/`
6. Create API endpoints in `api/v1/`
7. Write tests in `tests/` (1 happy + 2+ unhappy paths)
8. **Make small, atomic commits at each step** (see `.ai/git-workflow.md`)
9. **Run tests and linters before each commit**: `pytest && ruff check . && mypy src/`
10. Update API documentation

### Commit Strategy for New Feature
Break into small commits following Continuous Delivery:
```bash
git commit -m "feat(product): add Product model"
git commit -m "feat(product): add database migration for products table"
git commit -m "feat(product): add ProductCreate and ProductResponse schemas"
git commit -m "feat(product): add ProductRepository with CRUD operations"
git commit -m "test(product): add repository tests (1 happy + 2 unhappy)"
git commit -m "feat(product): add ProductService business logic"
git commit -m "test(product): add service tests (1 happy + 2 unhappy per method)"
git commit -m "feat(product): add API endpoints for product CRUD"
git commit -m "test(product): add integration tests for API endpoints"
git commit -m "docs(product): add product API examples to README"
```

### Adding a New Dependency
1. Add to `pyproject.toml` under appropriate section
2. Run `uv pip install` or `pip install -e .`
3. Document why it's needed in comments or docs
4. Pin exact version for critical dependencies
5. **Commit**: `chore(deps): add library-name for specific purpose`
6. Run tests to ensure no conflicts

## Performance Considerations

### Database
- Use connection pooling
- Add indexes for frequently queried fields
- Use `select_in_loading` for N+1 query prevention
- Consider caching for expensive queries

### API
- Use async operations for I/O
- Implement pagination for list endpoints
- Consider rate limiting for public endpoints
- Use background tasks for non-critical operations

## Security

### Authentication
- Hash passwords with bcrypt
- Use secure JWT tokens
- Implement refresh token rotation
- Validate all user inputs

### Data Protection
- Never log sensitive data
- Use environment variables for secrets
- Implement rate limiting
- Sanitize all user inputs

## Monitoring & Logging

### Logging
- Use structured logging (structlog)
- Include correlation IDs
- Log at appropriate levels
- Never log PII or secrets

### Metrics (if implemented)
- Track request latency
- Monitor error rates
- Track database query performance