# Preferred Code Patterns

## File Organization for 400-Line Limit

When files grow too large, use these splitting strategies:

### Split by Feature (Preferred)
```python
# Before: services/user_service.py (500 lines)

# After: Create a package
services/user/
├── __init__.py          # Public API exports
├── authentication.py    # Login, JWT, password reset
├── profile.py           # Profile updates, preferences
├── registration.py      # User registration flow
└── notifications.py     # Email, SMS notifications

# services/user/__init__.py - expose clean public API
from .authentication import authenticate_user, create_token
from .profile import update_profile, get_profile
from .registration import register_user

__all__ = [
    "authenticate_user",
    "create_token", 
    "update_profile",
    "get_profile",
    "register_user",
]
```

### Split by Concern
```python
# Before: api/v1/orders.py (450 lines with many endpoints)

# After: Split into logical groups
api/v1/orders/
├── __init__.py
├── crud.py         # Create, read, update, delete operations
├── search.py       # Search and filtering endpoints
├── analytics.py    # Reports and analytics endpoints
└── exports.py      # Export functionality (CSV, PDF)
```

### Split Large Models
```python
# Before: models/order.py (600 lines)

# After: 
models/order/
├── __init__.py
├── order.py        # Main Order model
├── items.py        # OrderItem model
├── payment.py      # Payment, Invoice models
├── shipping.py     # ShippingAddress model
└── enums.py        # OrderStatus, PaymentMethod enums
```

### Split Test Files
```python
# Before: tests/unit/test_user_service.py (500 lines)

# After:
tests/unit/user_service/
├── __init__.py
├── test_authentication.py
├── test_profile.py
├── test_registration.py
└── test_notifications.py
```

## Dependency Injection Pattern
```python
# services/user_service.py
from abc import ABC, abstractmethod

class UserRepository(ABC):
    @abstractmethod
    async def get_user(self, user_id: int) -> User | None:
        ...

class UserService:
    def __init__(self, repository: UserRepository):
        self.repository = repository
    
    async def get_active_user(self, user_id: int) -> User:
        user = await self.repository.get_user(user_id)
        if not user or not user.is_active:
            raise UserNotFoundError(f"Active user {user_id} not found")
        return user

# FastAPI endpoint
@app.get("/users/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service)
):
    return await service.get_active_user(user_id)
```

## Result Pattern for Error Handling
```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar('T')
E = TypeVar('E')

@dataclass
class Ok(Generic[T]):
    value: T

@dataclass
class Err(Generic[E]):
    error: E

Result = Ok[T] | Err[E]

# Usage
def divide(a: int, b: int) -> Result[float, str]:
    if b == 0:
        return Err("Division by zero")
    return Ok(a / b)

match divide(10, 2):
    case Ok(value):
        print(f"Result: {value}")
    case Err(error):
        print(f"Error: {error}")
```

## Repository Pattern
```python
from abc import ABC, abstractmethod

class Repository(ABC, Generic[T]):
    @abstractmethod
    async def get(self, id: int) -> T | None:
        ...
    
    @abstractmethod
    async def list(self, limit: int = 100, offset: int = 0) -> list[T]:
        ...
    
    @abstractmethod
    async def create(self, item: T) -> T:
        ...
    
    @abstractmethod
    async def update(self, id: int, item: T) -> T | None:
        ...
    
    @abstractmethod
    async def delete(self, id: int) -> bool:
        ...

class SQLAlchemyRepository(Repository[T]):
    def __init__(self, session: AsyncSession, model: type[T]):
        self.session = session
        self.model = model
    
    async def get(self, id: int) -> T | None:
        result = await self.session.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
```

## Settings Management
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Database
    database_url: str
    database_pool_size: int = 5
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = False
    
    # Security
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # External Services
    redis_url: str | None = None
    aws_region: str = "us-east-1"

settings = Settings()
```

## Factory Pattern for Testing
```python
# tests/factories.py
from datetime import datetime, timezone

class UserFactory:
    @staticmethod
    def create(
        id: int = 1,
        email: str = "test@example.com",
        name: str = "Test User",
        created_at: datetime | None = None,
        **kwargs
    ) -> User:
        return User(
            id=id,
            email=email,
            name=name,
            created_at=created_at or datetime.now(timezone.utc),
            **kwargs
        )

# Usage in tests
def test_user_service():
    user = UserFactory.create(email="custom@example.com")
    assert user.email == "custom@example.com"
```

## Async Context Managers
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def database_transaction(session: AsyncSession):
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()

# Usage
async with database_transaction(session) as tx:
    user = await tx.execute(select(User).where(User.id == 1))
```

## Service Layer Pattern
```python
class OrderService:
    def __init__(
        self,
        order_repo: OrderRepository,
        inventory_service: InventoryService,
        payment_service: PaymentService,
        notification_service: NotificationService,
    ):
        self.order_repo = order_repo
        self.inventory_service = inventory_service
        self.payment_service = payment_service
        self.notification_service = notification_service
    
    async def create_order(self, order_data: OrderCreate) -> Order:
        # Check inventory
        if not await self.inventory_service.check_availability(order_data.items):
            raise InsufficientInventoryError()
        
        # Create order
        order = await self.order_repo.create(order_data)
        
        # Process payment
        payment = await self.payment_service.process(
            order.id, 
            order.total_amount
        )
        
        # Reserve inventory
        await self.inventory_service.reserve(order.items)
        
        # Send notification
        await self.notification_service.send_order_confirmation(order)
        
        return order
```

## Event-Driven Pattern
```python
from dataclasses import dataclass
from datetime import datetime, timezone

@dataclass
class Event:
    event_type: str
    timestamp: datetime
    data: dict

class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
    
    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    async def publish(self, event: Event):
        handlers = self._handlers.get(event.event_type, [])
        await asyncio.gather(*[handler(event) for handler in handlers])

# Usage
event_bus = EventBus()

async def on_user_created(event: Event):
    user_id = event.data["user_id"]
    await send_welcome_email(user_id)

event_bus.subscribe("user.created", on_user_created)

# Publish event
await event_bus.publish(Event(
    event_type="user.created",
    timestamp=datetime.now(timezone.utc),
    data={"user_id": 123}
))
```

## Builder Pattern for Complex Objects
```python
class QueryBuilder:
    def __init__(self, model):
        self.model = model
        self._filters = []
        self._order_by = []
        self._limit = None
        self._offset = None
    
    def filter(self, *conditions):
        self._filters.extend(conditions)
        return self
    
    def order_by(self, *columns):
        self._order_by.extend(columns)
        return self
    
    def limit(self, limit: int):
        self._limit = limit
        return self
    
    def offset(self, offset: int):
        self._offset = offset
        return self
    
    def build(self):
        query = select(self.model)
        for condition in self._filters:
            query = query.where(condition)
        for column in self._order_by:
            query = query.order_by(column)
        if self._limit:
            query = query.limit(self._limit)
        if self._offset:
            query = query.offset(self._offset)
        return query

# Usage
query = (QueryBuilder(User)
    .filter(User.age >= 18)
    .filter(User.is_active == True)
    .order_by(User.created_at.desc())
    .limit(10)
    .build())
```