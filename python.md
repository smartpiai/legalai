# Python/FastAPI Best Practices - Legal AI Platform

## Core Principles
You are developing a Python 3.11+ backend with FastAPI for an enterprise legal AI platform. Follow TDD (Test-Driven Development) using the Red-Green-Refactor cycle religiously. Every feature starts with a failing test.

## TDD Cycle: Red-Green-Refactor

### 1. RED Phase - Write a Failing Test First
```python
# =4 ALWAYS START HERE - Write test that fails
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from app.main import app

@pytest.mark.asyncio
async def test_contract_upload_validates_tenant_isolation():
    """Test that contracts are completely isolated between tenants."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Attempt to access another tenant's contract
        response = await client.get(
            "/api/v1/contracts/123",
            headers={
                "Authorization": "Bearer tenant-a-token",
                "X-Tenant-ID": "tenant-a"
            }
        )
        
        assert response.status_code == 404  # Should not find tenant-b's contract
        assert "Contract not found" in response.json()["detail"]
```

### 2. GREEN Phase - Write Minimum Code to Pass
```python
# =â Write ONLY enough code to make test pass
from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_tenant, get_current_user

router = APIRouter(prefix="/contracts", tags=["contracts"])

@router.get("/{contract_id}")
async def get_contract(
    contract_id: int,
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    # Minimal implementation with tenant isolation
    contract = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.tenant_id == tenant_id  # Critical: tenant isolation
        )
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return contract
```

### 3. REFACTOR Phase - Improve Without Breaking Tests
```python
# =5 Refactor for quality while keeping tests green
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.contract_service import ContractService
from app.core.dependencies import (
    get_current_user, 
    get_current_tenant,
    get_db
)
from app.schemas.contract import ContractResponse
from app.models.user import User
from app.core.exceptions import ContractNotFoundError

router = APIRouter(
    prefix="/contracts", 
    tags=["contracts"],
    dependencies=[Depends(get_current_user)]
)

@router.get(
    "/{contract_id}", 
    response_model=ContractResponse,
    summary="Get contract by ID",
    description="Retrieve a contract by its ID with tenant isolation"
)
async def get_contract(
    contract_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[str, Depends(get_current_tenant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    contract_service: Annotated[ContractService, Depends()]
):
    """
    Retrieve a contract by ID with complete tenant isolation.
    
    - **contract_id**: The unique identifier of the contract
    - **Returns**: Contract details if found and accessible
    - **Raises**: 404 if contract not found or belongs to different tenant
    """
    try:
        contract = await contract_service.get_by_id(
            contract_id=contract_id,
            tenant_id=tenant_id,
            user_id=current_user.id,
            db=db
        )
        
        # Log access for audit trail
        await contract_service.log_access(
            contract_id=contract_id,
            user_id=current_user.id,
            action="view"
        )
        
        return ContractResponse.from_orm(contract)
        
    except ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found or access denied"
        )
```

## Service Layer Architecture

### Repository Pattern
```python
# repositories/contract_repository.py
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

class ContractRepository:
    """Repository for contract data operations with tenant isolation."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(
        self, 
        contract_id: int, 
        tenant_id: str
    ) -> Optional[Contract]:
        """Get contract by ID with tenant isolation."""
        result = await self.db.execute(
            select(Contract).where(
                and_(
                    Contract.id == contract_id,
                    Contract.tenant_id == tenant_id,
                    Contract.is_deleted == False
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def create(
        self, 
        contract_data: dict, 
        tenant_id: str
    ) -> Contract:
        """Create a new contract with tenant assignment."""
        contract = Contract(
            **contract_data,
            tenant_id=tenant_id
        )
        self.db.add(contract)
        await self.db.commit()
        await self.db.refresh(contract)
        return contract
```

### Service Layer Pattern
```python
# services/contract_service.py
from typing import Optional, List
from datetime import datetime
from app.repositories.contract_repository import ContractRepository
from app.services.ai_services.entity_extractor import EntityExtractor
from app.services.notification_service import NotificationService
from app.core.exceptions import ContractNotFoundError, ValidationError

class ContractService:
    """Business logic for contract operations."""
    
    def __init__(
        self,
        repository: ContractRepository,
        entity_extractor: EntityExtractor,
        notification_service: NotificationService
    ):
        self.repository = repository
        self.entity_extractor = entity_extractor
        self.notification_service = notification_service
    
    async def create_contract(
        self,
        contract_data: ContractCreate,
        tenant_id: str,
        user_id: int
    ) -> Contract:
        """Create contract with AI entity extraction."""
        # Validate business rules
        await self._validate_contract_data(contract_data, tenant_id)
        
        # Extract entities using AI
        entities = await self.entity_extractor.extract(
            contract_data.content
        )
        
        # Create contract
        contract = await self.repository.create(
            {
                **contract_data.dict(),
                "entities": entities,
                "created_by": user_id,
                "status": ContractStatus.DRAFT
            },
            tenant_id=tenant_id
        )
        
        # Send notifications
        await self.notification_service.notify_contract_created(
            contract_id=contract.id,
            user_id=user_id
        )
        
        return contract
    
    async def _validate_contract_data(
        self, 
        data: ContractCreate, 
        tenant_id: str
    ):
        """Validate contract data against business rules."""
        if data.value and data.value > 10_000_000:
            # High-value contracts need additional approval
            data.requires_approval = True
        
        if data.end_date and data.end_date < datetime.now():
            raise ValidationError("End date cannot be in the past")
```

## Multi-Tenant Implementation

### Tenant Isolation Middleware
```python
# core/middleware.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Ensure complete tenant isolation for all requests."""
    
    async def dispatch(self, request: Request, call_next):
        # Extract tenant from JWT or header
        tenant_id = request.headers.get("X-Tenant-ID")
        
        if not tenant_id and request.url.path.startswith("/api/v1"):
            # Skip for public endpoints
            if request.url.path not in PUBLIC_ENDPOINTS:
                raise HTTPException(
                    status_code=401,
                    detail="Tenant identification required"
                )
        
        # Store tenant in request state
        request.state.tenant_id = tenant_id
        
        # Add tenant to logging context
        with logger.contextualize(tenant_id=tenant_id):
            response = await call_next(request)
        
        return response
```

### Database Multi-Tenancy
```python
# models/base.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declared_attr
from datetime import datetime

class TenantMixin:
    """Mixin for multi-tenant models."""
    
    @declared_attr
    def tenant_id(cls):
        return Column(String(50), nullable=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False, nullable=False)

# models/contract.py
from app.models.base import Base, TenantMixin

class Contract(Base, TenantMixin):
    """Contract model with multi-tenant support."""
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    content = Column(Text)
    status = Column(Enum(ContractStatus), default=ContractStatus.DRAFT)
    
    # Ensure tenant isolation in queries
    __table_args__ = (
        Index("ix_contract_tenant_status", "tenant_id", "status"),
    )
```

## API Design Standards

### Pagination Pattern
```python
# schemas/pagination.py
from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")

class PaginationParams(BaseModel):
    """Standard pagination parameters."""
    offset: int = 0
    limit: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"

class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response."""
    items: List[T]
    total: int
    offset: int
    limit: int
    has_more: bool

# api/v1/contracts.py
@router.get("/", response_model=PaginatedResponse[ContractResponse])
async def list_contracts(
    pagination: Annotated[PaginationParams, Depends()],
    filters: Annotated[ContractFilters, Depends()],
    tenant_id: Annotated[str, Depends(get_current_tenant)],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """List contracts with pagination and filtering."""
    query = select(Contract).where(
        Contract.tenant_id == tenant_id,
        Contract.is_deleted == False
    )
    
    # Apply filters
    if filters.status:
        query = query.where(Contract.status == filters.status)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)
    
    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    query = query.order_by(
        desc(getattr(Contract, pagination.sort_by))
        if pagination.sort_order == "desc"
        else asc(getattr(Contract, pagination.sort_by))
    )
    
    result = await db.execute(query)
    contracts = result.scalars().all()
    
    return PaginatedResponse(
        items=[ContractResponse.from_orm(c) for c in contracts],
        total=total,
        offset=pagination.offset,
        limit=pagination.limit,
        has_more=(pagination.offset + pagination.limit) < total
    )
```

### Error Handling Pattern
```python
# core/exceptions.py
from fastapi import HTTPException, status

class LegalAIException(Exception):
    """Base exception for Legal AI Platform."""
    pass

class ContractNotFoundError(LegalAIException):
    """Raised when contract is not found."""
    pass

class InsufficientPermissionsError(LegalAIException):
    """Raised when user lacks required permissions."""
    pass

# core/error_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def legal_ai_exception_handler(
    request: Request, 
    exc: LegalAIException
):
    """Handle custom exceptions with standard format."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "type": "https://api.legal-ai.com/errors/" + exc.__class__.__name__,
            "title": exc.__class__.__name__.replace("Error", ""),
            "detail": str(exc),
            "instance": str(request.url),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# main.py
app.add_exception_handler(LegalAIException, legal_ai_exception_handler)
```

## Testing Patterns

### Async Test Fixtures
```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.main import app
from app.core.database import Base

@pytest_asyncio.fixture
async def async_db():
    """Create test database session."""
    engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost/test_db"
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def client(async_db):
    """Create test client with database override."""
    app.dependency_overrides[get_db] = lambda: async_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers(tenant_id="test-tenant"):
    """Generate auth headers for testing."""
    return {
        "Authorization": "Bearer test-token",
        "X-Tenant-ID": tenant_id
    }
```

### Service Testing Pattern
```python
# tests/services/test_contract_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.contract_service import ContractService

class TestContractService:
    """Test contract service business logic."""
    
    @pytest.fixture
    def mock_repository(self):
        """Create mock repository."""
        repo = AsyncMock()
        repo.get_by_id = AsyncMock(return_value=None)
        repo.create = AsyncMock()
        return repo
    
    @pytest.fixture
    def mock_ai_service(self):
        """Create mock AI service."""
        service = AsyncMock()
        service.extract_entities = AsyncMock(
            return_value={"parties": ["Company A", "Company B"]}
        )
        return service
    
    @pytest.fixture
    def contract_service(self, mock_repository, mock_ai_service):
        """Create contract service with mocks."""
        return ContractService(
            repository=mock_repository,
            entity_extractor=mock_ai_service,
            notification_service=AsyncMock()
        )
    
    @pytest.mark.asyncio
    async def test_create_contract_with_ai_extraction(
        self, 
        contract_service,
        mock_repository,
        mock_ai_service
    ):
        """Test contract creation with AI entity extraction."""
        # Arrange
        contract_data = ContractCreate(
            title="Test Contract",
            content="Agreement between Company A and Company B",
            value=50000
        )
        
        # Act
        result = await contract_service.create_contract(
            contract_data=contract_data,
            tenant_id="tenant-1",
            user_id=1
        )
        
        # Assert
        mock_ai_service.extract_entities.assert_called_once_with(
            "Agreement between Company A and Company B"
        )
        mock_repository.create.assert_called_once()
        assert result is not None
```

## Background Tasks with Celery

### Task Definition
```python
# tasks/document_tasks.py
from celery import shared_task
from app.services.extraction_service import ExtractionService

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_document_async(self, document_id: int, tenant_id: str):
    """Process document asynchronously with retries."""
    try:
        # Initialize services
        extraction_service = ExtractionService()
        
        # Process document
        result = extraction_service.extract_metadata(
            document_id=document_id,
            tenant_id=tenant_id
        )
        
        # Update document status
        update_document_status(document_id, "processed")
        
        return result
        
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

## Common CLM Patterns

### Contract Lifecycle Management
```python
# services/clm/contract_lifecycle.py
from enum import Enum
from typing import Optional
from datetime import datetime, timedelta

class ContractStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"

class ContractLifecycleService:
    """Manage contract lifecycle transitions."""
    
    VALID_TRANSITIONS = {
        ContractStatus.DRAFT: [ContractStatus.REVIEW],
        ContractStatus.REVIEW: [ContractStatus.DRAFT, ContractStatus.APPROVED],
        ContractStatus.APPROVED: [ContractStatus.ACTIVE],
        ContractStatus.ACTIVE: [ContractStatus.EXPIRED, ContractStatus.TERMINATED],
    }
    
    async def transition_status(
        self,
        contract_id: int,
        new_status: ContractStatus,
        user_id: int,
        reason: Optional[str] = None
    ):
        """Transition contract to new status with validation."""
        contract = await self.get_contract(contract_id)
        
        # Validate transition
        if new_status not in self.VALID_TRANSITIONS.get(contract.status, []):
            raise ValidationError(
                f"Invalid transition from {contract.status} to {new_status}"
            )
        
        # Apply business rules
        if new_status == ContractStatus.ACTIVE:
            contract.activated_at = datetime.utcnow()
            
            # Set expiration monitoring
            if contract.end_date:
                await self.schedule_expiration_check(
                    contract_id=contract.id,
                    check_date=contract.end_date - timedelta(days=30)
                )
        
        # Update status
        contract.status = new_status
        await self.save_contract(contract)
        
        # Audit log
        await self.log_transition(
            contract_id=contract_id,
            old_status=contract.status,
            new_status=new_status,
            user_id=user_id,
            reason=reason
        )
```

## Performance Optimization

### Database Query Optimization
```python
# repositories/optimized_repository.py
from sqlalchemy.orm import selectinload, joinedload

class OptimizedContractRepository:
    """Repository with query optimization."""
    
    async def get_contracts_with_relationships(
        self, 
        tenant_id: str,
        include_parties: bool = False,
        include_documents: bool = False
    ):
        """Get contracts with eager loading of relationships."""
        query = select(Contract).where(
            Contract.tenant_id == tenant_id
        )
        
        # Eager load relationships to avoid N+1 queries
        if include_parties:
            query = query.options(selectinload(Contract.parties))
        
        if include_documents:
            query = query.options(
                selectinload(Contract.documents).selectinload(Document.metadata)
            )
        
        # Use read replica for read-heavy operations
        result = await self.read_db.execute(query)
        return result.scalars().all()
```

### Caching Strategy
```python
# services/cached_service.py
from app.core.cache import cache
import hashlib
import json

class CachedContractService:
    """Service with Redis caching."""
    
    @cache(expire=3600)  # Cache for 1 hour
    async def get_contract_summary(
        self, 
        contract_id: int, 
        tenant_id: str
    ):
        """Get contract summary with caching."""
        # This will only run if not in cache
        contract = await self.repository.get_by_id(contract_id, tenant_id)
        
        return {
            "id": contract.id,
            "title": contract.title,
            "status": contract.status,
            "parties": await self.extract_parties(contract),
            "key_dates": await self.extract_key_dates(contract)
        }
    
    def _cache_key(self, contract_id: int, tenant_id: str) -> str:
        """Generate cache key with tenant isolation."""
        return f"contract:{tenant_id}:{contract_id}:summary"
```

## Security Patterns

### Input Validation
```python
# schemas/validation.py
from pydantic import BaseModel, validator, constr, conint
import bleach

class ContractCreate(BaseModel):
    """Contract creation with strict validation."""
    
    title: constr(min_length=1, max_length=255, strip_whitespace=True)
    content: constr(min_length=1, max_length=1_000_000)
    value: Optional[conint(ge=0, le=1_000_000_000)]
    
    @validator("content")
    def sanitize_content(cls, v):
        """Sanitize HTML content to prevent XSS."""
        return bleach.clean(
            v,
            tags=["p", "br", "strong", "em", "ul", "ol", "li"],
            strip=True
        )
    
    @validator("title")
    def validate_title(cls, v):
        """Ensure title doesn't contain special characters."""
        if any(char in v for char in ["<", ">", ";", "&"]):
            raise ValueError("Title contains invalid characters")
        return v
```

## Best Practices Summary

1. **Always start with tests** - TDD is non-negotiable
2. **Maintain tenant isolation** - Every query must filter by tenant_id
3. **Use dependency injection** - FastAPI's Depends for all services
4. **Keep files under 750 lines** - Refactor when approaching limit
5. **Type everything** - Use type hints and Pydantic models
6. **Handle errors gracefully** - Structured error responses
7. **Log comprehensively** - Include tenant_id and user_id in logs
8. **Cache strategically** - Redis for frequently accessed data
9. **Validate all inputs** - Pydantic validation and sanitization
10. **Document thoroughly** - OpenAPI specs and docstrings