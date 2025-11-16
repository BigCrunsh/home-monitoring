# Reference Code Examples

## Testing Pattern: 1 Happy Path + 2+ Unhappy Paths

**CRITICAL RULE**: For every happy path test, write at least 2 unhappy path tests.

### Example Test Suite Structure
```python
# tests/unit/test_user_service.py
import pytest
from unittest.mock import AsyncMock

class TestCreateUser:
    """Test suite for user creation - demonstrates 1:2 happy:unhappy ratio."""
    
    @pytest.mark.asyncio
    async def test_create_user_success(self):
        """Happy path: Valid user creation."""
        # Arrange
        repo = AsyncMock(spec=UserRepository)
        repo.get_by_email.return_value = None
        repo.create.return_value = User(id=1, email="test@example.com", name="Test", age=25)
        
        service = UserService(repo)
        user_data = UserCreate(email="test@example.com", name="Test", age=25)
        
        # Act
        result = await service.create_user(user_data)
        
        # Assert
        assert result.id == 1
        assert result.email == "test@example.com"
        repo.get_by_email.assert_awaited_once_with("test@example.com")
        repo.create.assert_awaited_once()
    
    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self):
        """Unhappy path 1: Email already exists."""
        # Arrange
        repo = AsyncMock(spec=UserRepository)
        repo.get_by_email.return_value = User(id=999, email="test@example.com")
        
        service = UserService(repo)
        user_data = UserCreate(email="test@example.com", name="Test", age=25)
        
        # Act & Assert
        with pytest.raises(DuplicateEmailError) as exc_info:
            await service.create_user(user_data)
        
        assert "already exists" in str(exc_info.value).lower()
        repo.create.assert_not_awaited()
    
    @pytest.mark.asyncio
    async def test_create_user_invalid_age(self):
        """Unhappy path 2: Invalid age value."""
        # Arrange
        service = UserService(AsyncMock(spec=UserRepository))
        
        # Act & Assert - Pydantic validation should catch this
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(email="test@example.com", name="Test", age=-5)
        
        errors = exc_info.value.errors()
        assert any(err["loc"] == ("age",) for err in errors)
    
    @pytest.mark.asyncio
    async def test_create_user_database_error(self):
        """Unhappy path 3 (bonus): Database connection failure."""
        # Arrange
        repo = AsyncMock(spec=UserRepository)
        repo.get_by_email.return_value = None
        repo.create.side_effect = DatabaseError("Connection lost")
        
        service = UserService(repo)
        user_data = UserCreate(email="test@example.com", name="Test", age=25)
        
        # Act & Assert
        with pytest.raises(DatabaseError):
            await service.create_user(user_data)

class TestGetUser:
    """Another example: 1 happy + 2 unhappy paths."""
    
    @pytest.mark.asyncio
    async def test_get_user_success(self):
        """Happy path: User exists and is returned."""
        repo = AsyncMock(spec=UserRepository)
        expected_user = User(id=1, email="test@example.com")
        repo.get_by_id.return_value = expected_user
        
        service = UserService(repo)
        result = await service.get_user(1)
        
        assert result == expected_user
    
    @pytest.mark.asyncio
    async def test_get_user_not_found(self):
        """Unhappy path 1: User doesn't exist."""
        repo = AsyncMock(spec=UserRepository)
        repo.get_by_id.return_value = None
        
        service = UserService(repo)
        
        with pytest.raises(UserNotFoundError):
            await service.get_user(999)
    
    @pytest.mark.asyncio
    async def test_get_user_inactive(self):
        """Unhappy path 2: User exists but is inactive."""
        repo = AsyncMock(spec=UserRepository)
        inactive_user = User(id=1, email="test@example.com", is_active=False)
        repo.get_by_id.return_value = inactive_user
        
        service = UserService(repo)
        
        with pytest.raises(UserNotFoundError) as exc_info:
            await service.get_user(1)
        
        assert "inactive" in str(exc_info.value).lower()
```

## Common Unhappy Path Categories

When writing your 2+ unhappy path tests, consider these categories:

1. **Validation Errors**
   - Invalid format (email, phone, URL)
   - Out of range values (age < 0, price negative)
   - Missing required fields
   - String too long/short

2. **State Errors**
   - Resource already exists (duplicate)
   - Resource not found (404)
   - Resource in wrong state (inactive user, closed order)
   - Insufficient permissions

3. **External Failures**
   - Database connection errors
   - Network timeouts
   - Third-party API failures
   - File system errors

4. **Business Logic Violations**
   - Insufficient balance
   - Expired tokens
   - Conflicting operations
   - Rate limit exceeded

## FastAPI Endpoint (Modern)
```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/users", tags=["users"])

class UserCreate(BaseModel):
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    age: int
    created_at: datetime
    
    model_config = {"from_attributes": True}

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Creates a new user with the provided information"
)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Create a new user.
    
    Args:
        user_data: User creation data
        service: Injected user service
        current_user: Current authenticated user
        
    Returns:
        Created user data
        
    Raises:
        HTTPException: 400 if email already exists
    """
    try:
        user = await service.create_user(user_data)
        return UserResponse.model_validate(user)
    except DuplicateEmailError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
```

## SQLAlchemy Model (2.0 Style)
```python
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int]
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    orders: Mapped[list["Order"]] = relationship(back_populates="user")
    
    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active"),
    )
    
    def __repr__(self) -> str:
        return f"User(id={self.id}, email={self.email})"
```

## Async Repository Implementation
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def list_active(
        self, 
        limit: int = 100, 
        offset: int = 0
    ) -> list[User]:
        result = await self.session.execute(
            select(User)
            .where(User.is_active == True)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
    
    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user
    
    async def update(self, user_id: int, **kwargs) -> User | None:
        await self.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(**kwargs)
        )
        return await self.get_by_id(user_id)
    
    async def delete(self, user_id: int) -> bool:
        result = await self.session.execute(
            delete(User).where(User.id == user_id)
        )
        return result.rowcount > 0
```

## Pytest Fixtures
```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from httpx import AsyncClient

@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        yield session
    
    await engine.dispose()

@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_session] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

## Integration Tests (1 Happy + 2+ Unhappy Pattern)
```python
# tests/integration/test_user_api.py
import pytest
from httpx import AsyncClient

class TestCreateUserEndpoint:
    """Integration tests following 1:2+ happy:unhappy ratio."""
    
    @pytest.mark.asyncio
    async def test_create_user_success(self, client: AsyncClient):
        """Happy path: Valid user creation."""
        response = await client.post(
            "/api/v1/users/",
            json={
                "email": "test@example.com",
                "name": "Test User",
                "age": 25
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "id" in data
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, client: AsyncClient):
        """Unhappy path 1: Email already exists."""
        # Create first user
        await client.post(
            "/api/v1/users/",
            json={"email": "duplicate@example.com", "name": "First", "age": 25}
        )
        
        # Try to create second user with same email
        response = await client.post(
            "/api/v1/users/",
            json={"email": "duplicate@example.com", "name": "Second", "age": 30}
        )
        
        assert response.status_code == 400
        assert "email" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_create_user_invalid_data(self, client: AsyncClient):
        """Unhappy path 2: Invalid input data."""
        response = await client.post(
            "/api/v1/users/",
            json={
                "email": "not-an-email",  # Invalid email format
                "name": "",  # Empty name
                "age": -5  # Negative age
            }
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        error_fields = {err["loc"][-1] for err in errors}
        assert "email" in error_fields
        assert "name" in error_fields or "age" in error_fields
    
    @pytest.mark.asyncio
    async def test_create_user_missing_fields(self, client: AsyncClient):
        """Unhappy path 3 (bonus): Required fields missing."""
        response = await client.post(
            "/api/v1/users/",
            json={"name": "Test User"}  # Missing email and age
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        missing_fields = {err["loc"][-1] for err in errors}
        assert "email" in missing_fields
        assert "age" in missing_fields
```

## Structured Logging
```python
import structlog
from datetime import datetime, timezone

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger()

# Usage
async def process_order(order_id: int):
    logger.info("order_processing_started", order_id=order_id)
    
    try:
        order = await fetch_order(order_id)
        logger.info(
            "order_fetched",
            order_id=order_id,
            total_amount=order.total_amount,
            item_count=len(order.items)
        )
        
        result = await process(order)
        logger.info(
            "order_processing_completed",
            order_id=order_id,
            processing_time_ms=result.duration_ms
        )
        return result
        
    except ValidationError as e:
        logger.error(
            "order_validation_failed",
            order_id=order_id,
            error=str(e),
            error_type=type(e).__name__
        )
        raise
```

## Async Background Tasks
```python
import asyncio
from datetime import datetime, timezone

class BackgroundTasks:
    def __init__(self):
        self._tasks: set[asyncio.Task] = set()
    
    def add_task(self, coro):
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task
    
    async def wait_all(self):
        await asyncio.gather(*self._tasks, return_exceptions=True)

# Usage in FastAPI
@router.post("/users/{user_id}/welcome")
async def send_welcome(
    user_id: int,
    background_tasks: BackgroundTasks = Depends()
):
    background_tasks.add_task(send_welcome_email(user_id))
    background_tasks.add_task(create_welcome_notification(user_id))
    return {"status": "processing"}

async def send_welcome_email(user_id: int):
    logger.info("sending_welcome_email", user_id=user_id)
    # Email sending logic
    await asyncio.sleep(1)  # Simulate email send
    logger.info("welcome_email_sent", user_id=user_id)
```

## Error Response Models
```python
from enum import Enum
from pydantic import BaseModel

class ErrorCode(str, Enum):
    VALIDATION_ERROR = "validation_error"
    NOT_FOUND = "not_found"
    UNAUTHORIZED = "unauthorized"
    INTERNAL_ERROR = "internal_error"

class ErrorDetail(BaseModel):
    field: str | None = None
    message: str
    code: str

class ErrorResponse(BaseModel):
    error: ErrorCode
    message: str
    details: list[ErrorDetail] | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Usage
@app.exception_handler(ValidationException)
async def validation_exception_handler(request: Request, exc: ValidationException):
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error=ErrorCode.VALIDATION_ERROR,
            message="Validation failed",
            details=[
                ErrorDetail(field=err["field"], message=err["message"], code="invalid")
                for err in exc.errors
            ]
        ).model_dump()
    )
```