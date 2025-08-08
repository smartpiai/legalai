# Python/FastAPI TDD Best Practices - Legal AI Platform

## Core Principles
You are developing a Python 3.11 backend with FastAPI for an enterprise legal AI platform. Follow TDD (Test-Driven Development) using the Red-Green-Refactor cycle religiously. Every feature starts with a failing test.

## TDD Cycle: Red-Green-Refactor

### 1. RED Phase - Write a Failing Test First
```python
# L ALWAYS START HERE - Write test that fails
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_contract_upload_validates_file_type():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Upload invalid file type
        files = {"file": ("test.exe", b"content", "application/x-msdownload")}
        response = await client.post(
            "/api/v1/contracts/upload",
            files=files,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]
```

### 2. GREEN Phase - Write Minimum Code to Pass
```python
#  Write ONLY enough code to make test pass
from fastapi import APIRouter, UploadFile, HTTPException

router = APIRouter()

ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

@router.post("/upload")
async def upload_contract(file: UploadFile):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Minimum implementation
    return {"message": "File uploaded"}
```

### 3. REFACTOR Phase - Improve Without Breaking Tests
```python
# = Refactor for quality while keeping tests green
from fastapi import APIRouter, UploadFile, Depends, HTTPException
from typing import Annotated
from app.services.file_service import FileService
from app.services.contract_service import ContractService
from app.core.dependencies import get_current_user, get_tenant
from app.schemas.contract import ContractUploadResponse
from app.core.exceptions import InvalidFileTypeError

router = APIRouter(prefix="/contracts", tags=["contracts"])

@router.post("/upload", response_model=ContractUploadResponse)
async def upload_contract(
    file: UploadFile,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant: Annotated[Tenant, Depends(get_tenant)],
    file_service: Annotated[FileService, Depends()],
    contract_service: Annotated[ContractService, Depends()]
):
    """Upload and process a contract document."""
    try:
        # Validate file
        await file_service.validate_file(file)
        
        # Store file
        file_path = await file_service.store_file(file, tenant.id)
        
        # Create contract record
        contract = await contract_service.create_from_upload(
            file_path=file_path,
            user_id=current_user.id,
            tenant_id=tenant.id
        )
        
        return ContractUploadResponse.from_orm(contract)
        
    except InvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## Service Layer Testing

### 1. Service Test Structure
```python
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.services.contract_service import ContractService
from app.repositories.contract_repository import ContractRepository
from app.services.ai_services.entity_extractor import EntityExtractor

class TestContractService:
    @pytest.fixture
    def mock_repository(self):
        """Mock repository for testing."""
        repo = Mock(spec=ContractRepository)
        repo.create = AsyncMock()
        repo.get = AsyncMock()
        repo.update = AsyncMock()
        return repo
    
    @pytest.fixture
    def mock_entity_extractor(self):
        """Mock AI service for testing."""
        extractor = Mock(spec=EntityExtractor)
        extractor.extract_entities = AsyncMock(return_value={
            "parties": ["Acme Corp", "Legal AI Inc"],
            "dates": ["2024-01-01", "2024-12-31"],
            "obligations": ["Monthly payment of $10,000"]
        })
        return extractor
    
    @pytest.fixture
    def contract_service(self, mock_repository, mock_entity_extractor):
        """Service instance with mocked dependencies."""
        return ContractService(
            repository=mock_repository,
            entity_extractor=mock_entity_extractor
        )
    
    @pytest.mark.asyncio
    async def test_create_contract_extracts_entities(self, contract_service, mock_entity_extractor):
        # Arrange
        contract_data = {
            "title": "Service Agreement",
            "content": "Agreement between Acme Corp and Legal AI Inc..."
        }
        
        # Act
        contract = await contract_service.create_contract(contract_data)
        
        # Assert
        mock_entity_extractor.extract_entities.assert_called_once_with(contract_data["content"])
        assert contract.parties == ["Acme Corp", "Legal AI Inc"]
        assert len(contract.obligations) == 1
    
    @pytest.mark.asyncio
    async def test_analyze_contract_risk(self, contract_service):
        # Test risk analysis
        contract_id = "contract-123"
        
        # Act
        risk_score = await contract_service.analyze_risk(contract_id)
        
        # Assert
        assert 0 <= risk_score <= 100
        assert isinstance(risk_score, float)
```

### 2. Repository Testing with Database
```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.models.contract import Contract
from app.repositories.contract_repository import ContractRepository
from app.core.database import Base

@pytest.fixture
async def test_db():
    """Create test database session."""
    engine = create_async_engine("postgresql+asyncpg://test:test@localhost/test_db")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    AsyncSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

class TestContractRepository:
    @pytest.mark.asyncio
    async def test_create_contract(self, test_db):
        # Arrange
        repo = ContractRepository(test_db)
        contract_data = {
            "title": "Test Contract",
            "tenant_id": "tenant-123",
            "created_by": "user-123"
        }
        
        # Act
        contract = await repo.create(contract_data)
        
        # Assert
        assert contract.id is not None
        assert contract.title == "Test Contract"
        assert contract.tenant_id == "tenant-123"
    
    @pytest.mark.asyncio
    async def test_get_by_tenant(self, test_db):
        # Arrange
        repo = ContractRepository(test_db)
        tenant_id = "tenant-123"
        
        # Create test data
        for i in range(5):
            await repo.create({
                "title": f"Contract {i}",
                "tenant_id": tenant_id
            })
        
        # Act
        contracts = await repo.get_by_tenant(tenant_id)
        
        # Assert
        assert len(contracts) == 5
        assert all(c.tenant_id == tenant_id for c in contracts)
```

### 3. API Endpoint Testing
```python
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.main import app
from app.core.auth import create_access_token

@pytest.fixture
def auth_headers():
    """Generate auth headers for testing."""
    token = create_access_token({"sub": "user-123", "tenant_id": "tenant-123"})
    return {"Authorization": f"Bearer {token}"}

class TestContractEndpoints:
    @pytest.mark.asyncio
    async def test_create_contract_success(self, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Arrange
            contract_data = {
                "title": "Service Agreement",
                "parties": ["Acme Corp", "Legal AI Inc"],
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "value": 100000
            }
            
            # Act
            response = await client.post(
                "/api/v1/contracts",
                json=contract_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 201
            data = response.json()
            assert data["title"] == "Service Agreement"
            assert "id" in data
    
    @pytest.mark.asyncio
    async def test_create_contract_validation_error(self, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Missing required fields
            response = await client.post(
                "/api/v1/contracts",
                json={"title": ""},  # Empty title
                headers=auth_headers
            )
            
            assert response.status_code == 422
            errors = response.json()["detail"]
            assert any(error["loc"] == ["body", "title"] for error in errors)
    
    @pytest.mark.asyncio
    async def test_get_contract_not_found(self, auth_headers):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/contracts/non-existent-id",
                headers=auth_headers
            )
            
            assert response.status_code == 404
            assert "Contract not found" in response.json()["detail"]
    
    @pytest.mark.asyncio
    @patch("app.services.ai_services.rag_service.RAGService.analyze")
    async def test_analyze_contract(self, mock_analyze, auth_headers):
        # Mock AI analysis
        mock_analyze.return_value = {
            "risks": ["Ambiguous termination clause"],
            "obligations": ["Monthly reports required"],
            "entities": ["Acme Corp", "Legal AI Inc"]
        }
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/contracts/contract-123/analyze",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["risks"]) == 1
            assert len(data["obligations"]) == 1
            assert len(data["entities"]) == 2
```

## Background Task Testing

### 1. Celery Task Testing
```python
import pytest
from unittest.mock import Mock, patch
from celery import Celery
from app.workers.tasks import process_contract, generate_report

@pytest.fixture
def celery_app():
    """Create test Celery app."""
    app = Celery("test", broker="memory://", backend="cache+memory://")
    app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )
    return app

class TestCeleryTasks:
    @patch("app.services.document_processor.DocumentProcessor.process")
    def test_process_contract_task(self, mock_process, celery_app):
        # Arrange
        contract_id = "contract-123"
        mock_process.return_value = {
            "extracted_text": "Contract content...",
            "metadata": {"pages": 10}
        }
        
        # Act
        result = process_contract.apply(args=[contract_id])
        
        # Assert
        assert result.successful()
        mock_process.assert_called_once_with(contract_id)
    
    @patch("app.services.report_service.ReportService.generate")
    def test_generate_report_task_with_retry(self, mock_generate, celery_app):
        # Simulate failure then success
        mock_generate.side_effect = [Exception("Service unavailable"), {"report": "data"}]
        
        # Act
        result = generate_report.apply(args=["report-123"])
        
        # Assert
        assert mock_generate.call_count == 2  # Retried once
        assert result.successful()
```

### 2. Async Task Testing
```python
import asyncio
import pytest
from app.workers.async_tasks import AsyncTaskProcessor

class TestAsyncTasks:
    @pytest.mark.asyncio
    async def test_batch_processing(self):
        # Arrange
        processor = AsyncTaskProcessor()
        contracts = [f"contract-{i}" for i in range(100)]
        
        # Act
        results = await processor.batch_process(contracts, batch_size=10)
        
        # Assert
        assert len(results) == 100
        assert all(r["status"] == "completed" for r in results)
    
    @pytest.mark.asyncio
    async def test_concurrent_processing_with_limit(self):
        # Arrange
        processor = AsyncTaskProcessor(max_concurrent=5)
        tasks = [asyncio.create_task(processor.process(f"item-{i}")) for i in range(20)]
        
        # Act
        results = await asyncio.gather(*tasks)
        
        # Assert
        assert len(results) == 20
        # Verify max 5 concurrent tasks
        assert processor.semaphore._value == 5
```

## AI Service Testing

### 1. RAG Service Testing
```python
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.services.ai_services.rag_service import RAGService
from app.services.ai_services.embeddings import EmbeddingService

class TestRAGService:
    @pytest.fixture
    def mock_embedding_service(self):
        service = Mock(spec=EmbeddingService)
        service.generate_embedding = AsyncMock(return_value=[0.1] * 768)
        return service
    
    @pytest.fixture
    def mock_vector_store(self):
        store = Mock()
        store.search = AsyncMock(return_value=[
            {"id": "doc-1", "content": "Relevant clause", "score": 0.9},
            {"id": "doc-2", "content": "Another clause", "score": 0.8}
        ])
        return store
    
    @pytest.fixture
    def rag_service(self, mock_embedding_service, mock_vector_store):
        return RAGService(
            embedding_service=mock_embedding_service,
            vector_store=mock_vector_store
        )
    
    @pytest.mark.asyncio
    async def test_retrieve_relevant_documents(self, rag_service):
        # Arrange
        query = "What are the payment terms?"
        
        # Act
        results = await rag_service.retrieve(query, top_k=5)
        
        # Assert
        assert len(results) == 2
        assert results[0]["score"] > results[1]["score"]
    
    @pytest.mark.asyncio
    @patch("app.services.ai_services.rag_service.openai.ChatCompletion.create")
    async def test_generate_answer(self, mock_openai, rag_service):
        # Arrange
        mock_openai.return_value = {
            "choices": [{
                "message": {"content": "The payment terms are monthly."}
            }]
        }
        
        # Act
        answer = await rag_service.generate_answer(
            query="What are the payment terms?",
            context=["Payment is due monthly on the 1st"]
        )
        
        # Assert
        assert "monthly" in answer.lower()
        mock_openai.assert_called_once()
```

### 2. Entity Extraction Testing
```python
class TestEntityExtractor:
    @pytest.mark.asyncio
    async def test_extract_legal_entities(self):
        # Arrange
        extractor = EntityExtractor()
        text = """
        This Agreement is entered into between Acme Corporation, 
        a Delaware corporation, and Legal AI Inc., a California corporation,
        on January 1, 2024. Payment of $50,000 is due within 30 days.
        """
        
        # Act
        entities = await extractor.extract(text)
        
        # Assert
        assert "Acme Corporation" in entities["organizations"]
        assert "Legal AI Inc." in entities["organizations"]
        assert "2024-01-01" in entities["dates"]
        assert 50000 in entities["monetary_values"]
        assert entities["jurisdictions"] == ["Delaware", "California"]
```

## Multi-Tenancy Testing

### 1. Tenant Isolation Testing
```python
import pytest
from app.core.tenant import TenantMiddleware, get_tenant_db

class TestMultiTenancy:
    @pytest.mark.asyncio
    async def test_tenant_isolation(self, test_db):
        # Arrange
        tenant1_id = "tenant-1"
        tenant2_id = "tenant-2"
        
        # Create contracts for different tenants
        contract1 = await create_contract(tenant_id=tenant1_id, title="Tenant 1 Contract")
        contract2 = await create_contract(tenant_id=tenant2_id, title="Tenant 2 Contract")
        
        # Act
        tenant1_contracts = await get_contracts_for_tenant(tenant1_id)
        tenant2_contracts = await get_contracts_for_tenant(tenant2_id)
        
        # Assert
        assert len(tenant1_contracts) == 1
        assert tenant1_contracts[0].title == "Tenant 1 Contract"
        
        assert len(tenant2_contracts) == 1
        assert tenant2_contracts[0].title == "Tenant 2 Contract"
    
    @pytest.mark.asyncio
    async def test_tenant_middleware(self):
        from fastapi import FastAPI, Request
        from fastapi.testclient import TestClient
        
        app = FastAPI()
        app.add_middleware(TenantMiddleware)
        
        @app.get("/test")
        async def test_endpoint(request: Request):
            return {"tenant_id": request.state.tenant_id}
        
        client = TestClient(app)
        
        # Test with tenant header
        response = client.get("/test", headers={"X-Tenant-ID": "tenant-123"})
        assert response.json()["tenant_id"] == "tenant-123"
        
        # Test without tenant header
        response = client.get("/test")
        assert response.status_code == 400
```

## Performance Testing

### 1. Load Testing
```python
import pytest
import asyncio
from locust import HttpUser, task, between

class ContractUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get token."""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpass"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    @task(3)
    def list_contracts(self):
        self.client.get("/api/v1/contracts", headers=self.headers)
    
    @task(2)
    def view_contract(self):
        contract_id = "contract-123"  # Use random from list
        self.client.get(f"/api/v1/contracts/{contract_id}", headers=self.headers)
    
    @task(1)
    def create_contract(self):
        self.client.post("/api/v1/contracts", 
            json={"title": "Test Contract", "parties": ["A", "B"]},
            headers=self.headers
        )

# Performance benchmark tests
class TestPerformance:
    @pytest.mark.asyncio
    async def test_bulk_insert_performance(self, test_db):
        # Arrange
        contracts = [
            {"title": f"Contract {i}", "tenant_id": "tenant-1"}
            for i in range(1000)
        ]
        
        # Act
        start_time = asyncio.get_event_loop().time()
        await bulk_insert_contracts(contracts)
        duration = asyncio.get_event_loop().time() - start_time
        
        # Assert
        assert duration < 5.0  # Should complete in under 5 seconds
    
    @pytest.mark.asyncio
    async def test_search_performance(self, test_db):
        # Arrange - Create test data
        await create_test_contracts(10000)
        
        # Act
        start_time = asyncio.get_event_loop().time()
        results = await search_contracts("agreement", limit=100)
        duration = asyncio.get_event_loop().time() - start_time
        
        # Assert
        assert duration < 0.5  # Search should be under 500ms
        assert len(results) <= 100
```

## Integration Testing

### 1. End-to-End Workflow Testing
```python
import pytest
from app.tests.factories import UserFactory, ContractFactory

class TestContractWorkflow:
    @pytest.mark.asyncio
    async def test_complete_contract_lifecycle(self, client, auth_headers):
        # 1. Upload contract
        with open("tests/fixtures/sample_contract.pdf", "rb") as f:
            response = await client.post(
                "/api/v1/contracts/upload",
                files={"file": ("contract.pdf", f, "application/pdf")},
                headers=auth_headers
            )
        assert response.status_code == 201
        contract_id = response.json()["id"]
        
        # 2. Wait for processing
        await asyncio.sleep(2)
        
        # 3. Check processing status
        response = await client.get(
            f"/api/v1/contracts/{contract_id}/status",
            headers=auth_headers
        )
        assert response.json()["status"] == "processed"
        
        # 4. Analyze contract
        response = await client.post(
            f"/api/v1/contracts/{contract_id}/analyze",
            headers=auth_headers
        )
        assert response.status_code == 200
        analysis = response.json()
        assert "risks" in analysis
        assert "entities" in analysis
        
        # 5. Create workflow
        response = await client.post(
            f"/api/v1/contracts/{contract_id}/workflows",
            json={"type": "approval", "participants": ["user-456"]},
            headers=auth_headers
        )
        assert response.status_code == 201
        workflow_id = response.json()["id"]
        
        # 6. Approve contract
        response = await client.post(
            f"/api/v1/workflows/{workflow_id}/approve",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # 7. Check final status
        response = await client.get(
            f"/api/v1/contracts/{contract_id}",
            headers=auth_headers
        )
        assert response.json()["status"] == "active"
```

## Test Fixtures and Factories

### 1. Factory Pattern for Test Data
```python
# tests/factories.py
import factory
from factory import fuzzy
from datetime import datetime, timedelta
from app.models import Contract, User, Tenant

class TenantFactory(factory.Factory):
    class Meta:
        model = Tenant
    
    id = factory.Faker("uuid4")
    name = factory.Faker("company")
    created_at = factory.Faker("date_time")

class UserFactory(factory.Factory):
    class Meta:
        model = User
    
    id = factory.Faker("uuid4")
    email = factory.Faker("email")
    full_name = factory.Faker("name")
    tenant_id = factory.SubFactory(TenantFactory)
    is_active = True

class ContractFactory(factory.Factory):
    class Meta:
        model = Contract
    
    id = factory.Faker("uuid4")
    title = factory.Faker("catch_phrase")
    parties = factory.List([
        factory.Faker("company"),
        factory.Faker("company")
    ])
    start_date = factory.Faker("date_between", start_date="-1y", end_date="today")
    end_date = factory.Faker("date_between", start_date="today", end_date="+2y")
    value = fuzzy.FuzzyDecimal(10000, 1000000, precision=2)
    status = fuzzy.FuzzyChoice(["draft", "negotiation", "active", "expired"])
    tenant_id = factory.SubFactory(TenantFactory)
    created_by = factory.SubFactory(UserFactory)

# Usage in tests
contract = ContractFactory.build()
contracts = ContractFactory.build_batch(10, status="active")
```

## Testing Best Practices

### 1. Test Organization
```python
# tests/
#    unit/
#       services/
#       repositories/
#       utils/
#    integration/
#       api/
#       workflows/
#       ai_services/
#    e2e/
#       scenarios/
#    fixtures/
#    factories.py
#    conftest.py

# conftest.py - Shared fixtures
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from app.main import app
from app.core.database import get_db

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def db_session():
    # Provide test database session
    pass
```

### 2. Mocking Strategies
```python
# Use dependency injection for easy mocking
from fastapi import Depends
from typing import Annotated

class ContractService:
    def __init__(
        self,
        repository: Annotated[ContractRepository, Depends()],
        ai_service: Annotated[AIService, Depends()]
    ):
        self.repository = repository
        self.ai_service = ai_service

# In tests, override dependencies
app.dependency_overrides[ContractRepository] = lambda: mock_repository
app.dependency_overrides[AIService] = lambda: mock_ai_service
```

## Testing Checklist

### Before Every Feature
- [ ] Write failing test first (RED)
- [ ] Implement minimum code to pass (GREEN)
- [ ] Refactor for quality (REFACTOR)
- [ ] Test error cases
- [ ] Test edge cases
- [ ] Test async behavior
- [ ] Test multi-tenancy isolation
- [ ] Test performance requirements

### Coverage Requirements
- [ ] Minimum 85% code coverage
- [ ] 100% coverage for business logic
- [ ] 100% coverage for API endpoints
- [ ] Integration tests for workflows
- [ ] E2E tests for critical paths

### Performance Targets
- [ ] API response < 200ms (simple queries)
- [ ] API response < 1s (complex queries)
- [ ] Bulk operations < 5s for 1000 records
- [ ] Search < 500ms for 100k documents
- [ ] Memory usage stable under load

## Common Pitfalls to Avoid

1. **Never test without database transactions** - Always rollback after tests
2. **Avoid testing framework code** - Focus on your business logic
3. **Don't share state between tests** - Each test should be independent
4. **Avoid time.sleep()** - Use asyncio.wait_for or mock time
5. **Never skip the RED phase** - Always see the test fail first
6. **Don't test external APIs directly** - Mock them
7. **Avoid hardcoded test data** - Use factories
8. **Don't ignore flaky tests** - Fix them immediately

## CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    - name: Run tests
      run: |
        pytest tests/ --cov=app --cov-report=xml
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

Remember: Every line of production code should exist because a test required it. No exceptions.