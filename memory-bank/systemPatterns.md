# System Patterns: Legal AI Platform

## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│                   React SPA + TypeScript                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│                      API Gateway Layer                       │
│                    FastAPI + Rate Limiting                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ CLM Services │  │ AI Services  │  │  Workflow    │     │
│  │              │  │              │  │   Engine     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      Data Layer                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │Postgres│ │ Neo4j  │ │ Qdrant │ │ Redis  │ │ MinIO  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Microservices Design
```
API Gateway
    ├── CLM Service
    │   ├── Contract Management
    │   ├── Template Engine
    │   ├── Clause Library
    │   └── Obligation Tracking
    ├── AI Service Layer
    │   ├── RAG Basic Service
    │   ├── GraphRAG Service
    │   ├── Neural RAG Service
    │   └── HRM Service
    ├── Integration Service
    │   ├── E-signature Connectors
    │   ├── CRM Connectors
    │   └── ERP Connectors
    └── Analytics Service
        ├── Reporting Engine
        └── Dashboard API
```

## Key Technical Decisions

### 1. Multi-Tenancy Strategy
**Pattern**: Schema-per-tenant isolation
**Rationale**: 
- Complete data isolation for security
- Easier compliance with data residency requirements
- Simplified backup and restore per tenant
- Performance isolation between tenants

**Implementation**:
- Tenant identification via JWT claims
- Dynamic schema routing in database layer
- Separate vector collections per tenant
- Isolated file storage buckets

### 2. Event-Driven Architecture
**Pattern**: Event sourcing with CQRS
**Components**:
- Command Bus: Handles write operations
- Query Bus: Optimized read operations
- Event Store: Audit trail and recovery
- Event Handlers: Async processing

**Benefits**:
- Complete audit trail for compliance
- Ability to replay events for debugging
- Scalable read/write separation
- Eventual consistency for non-critical operations

### 3. AI Service Orchestration
**Pattern**: Pipeline architecture with fallbacks
```
Request → Preprocessor → AI Pipeline → Postprocessor → Response
                            ├── Primary Model
                            ├── Fallback Model
                            └── Cache Layer
```

**Key Features**:
- Model versioning and A/B testing
- Automatic fallback on errors
- Result caching for repeated queries
- Performance monitoring per model

### 4. Document Processing Pipeline
**Pattern**: Staged processing with checkpoints
```
Upload → Validation → Storage → Extraction → Enrichment → Indexing
           ↓            ↓          ↓            ↓           ↓
        Checkpoint  Checkpoint  Checkpoint  Checkpoint  Complete
```

**Stages**:
1. **Validation**: Format, size, virus scan
2. **Storage**: Secure file storage with encryption
3. **Extraction**: OCR, text extraction, metadata
4. **Enrichment**: Entity extraction, classification
5. **Indexing**: Vector embeddings, search index

## Design Patterns in Use

### 1. Repository Pattern
**Location**: `backend/app/repositories/`
**Purpose**: Abstract database operations
```python
class ContractRepository:
    def find_by_id(id: UUID) -> Contract
    def find_by_tenant(tenant_id: UUID) -> List[Contract]
    def save(contract: Contract) -> Contract
    def delete(id: UUID) -> bool
```

### 2. Service Layer Pattern
**Location**: `backend/app/services/`
**Purpose**: Business logic encapsulation
```python
class ContractService:
    def __init__(self, repo: ContractRepository, ai: AIService)
    def create_contract(data: ContractCreate) -> Contract
    def analyze_contract(id: UUID) -> Analysis
```

### 3. Factory Pattern
**Location**: Various service initializations
**Purpose**: Complex object creation
```python
class AIModelFactory:
    @staticmethod
    def create_model(type: ModelType) -> BaseModel
```

### 4. Strategy Pattern
**Location**: `ml-services/shared/strategies/`
**Purpose**: Interchangeable algorithms
```python
class SearchStrategy(ABC):
    def search(query: str) -> Results

class SemanticSearch(SearchStrategy):
    def search(query: str) -> Results

class HybridSearch(SearchStrategy):
    def search(query: str) -> Results
```

### 5. Observer Pattern
**Location**: `backend/app/workers/`
**Purpose**: Event notification system
```python
class WorkflowEventObserver:
    def on_workflow_started(event: WorkflowEvent)
    def on_workflow_completed(event: WorkflowEvent)
    def on_workflow_failed(event: WorkflowEvent)
```

## Component Relationships

### Core Service Dependencies
```
ContractService
    ├── ContractRepository (data access)
    ├── DocumentProcessor (file handling)
    ├── AIService (intelligence)
    ├── WorkflowEngine (automation)
    └── NotificationService (alerts)

AIService
    ├── EmbeddingService (vectorization)
    ├── RAGService (retrieval)
    ├── EntityExtractor (NER)
    └── RiskAnalyzer (scoring)

WorkflowEngine
    ├── TaskQueue (Celery)
    ├── StateManager (Redis)
    ├── RuleEngine (conditions)
    └── NotificationService (alerts)
```

### Data Flow Patterns

#### Document Upload Flow
```
1. Frontend → API Gateway (auth check)
2. API Gateway → Upload Service (validation)
3. Upload Service → Storage Service (S3/MinIO)
4. Storage Service → Document Processor (async)
5. Document Processor → AI Services (extraction)
6. AI Services → Database (metadata storage)
7. Database → Search Index (indexing)
8. Complete → Notification Service → User
```

#### Search Query Flow
```
1. User Query → API Gateway
2. API Gateway → Search Service
3. Search Service → Query Processor (NLP)
4. Query Processor → Vector DB (embedding search)
5. Vector DB → Results Ranker
6. Results Ranker → Permission Filter
7. Permission Filter → Response Builder
8. Response → Frontend
```

## Critical Implementation Paths

### 1. Authentication Flow
```
Login Request
    → Validate Credentials
    → Generate JWT Token
    → Include Tenant Context
    → Set Refresh Token
    → Return Access Token
```

### 2. Contract Creation Path
```
Template Selection
    → Variable Input
    → Clause Assembly
    → Conflict Check
    → Approval Routing
    → Document Generation
    → Storage & Indexing
```

### 3. AI Analysis Path
```
Document Input
    → Text Extraction
    → Chunking Strategy
    → Embedding Generation
    → Vector Storage
    → Entity Extraction
    → Risk Analysis
    → Result Compilation
```

## Performance Optimization Patterns

### 1. Caching Strategy
- **Redis L1 Cache**: Session data, frequent queries
- **Application L2 Cache**: Computed results, AI outputs
- **CDN Edge Cache**: Static assets, public content

### 2. Database Optimization
- **Read Replicas**: Distribute read load
- **Connection Pooling**: Reuse database connections
- **Query Optimization**: Indexed columns, explain plans
- **Batch Operations**: Bulk inserts and updates

### 3. Async Processing
- **Background Jobs**: Document processing, AI analysis
- **Queue Management**: Priority queues for tasks
- **Batch Processing**: Nightly aggregations
- **Event Streaming**: Real-time updates

## Security Patterns

### 1. Defense in Depth
```
Layer 1: WAF and DDoS Protection
Layer 2: API Gateway Rate Limiting
Layer 3: Application Authentication
Layer 4: Service Authorization
Layer 5: Database Encryption
Layer 6: Audit Logging
```

### 2. Zero Trust Architecture
- Verify every request
- Principle of least privilege
- Network segmentation
- Continuous validation
- Encrypted communications

### 3. Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Key rotation policies
- Data masking for PII
- Secure deletion procedures

## Scalability Patterns

### 1. Horizontal Scaling
- Stateless services for easy scaling
- Load balancer distribution
- Database sharding strategy
- Distributed caching

### 2. Vertical Scaling
- Resource monitoring
- Auto-scaling policies
- Performance profiling
- Bottleneck identification

### 3. Edge Computing
- CDN for static content
- Regional deployments
- Edge functions for processing
- Geo-distributed databases

## Error Handling Patterns

### 1. Circuit Breaker
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60)
    def call(self, func, *args, **kwargs)
    def on_success(self)
    def on_failure(self)
    def reset(self)
```

### 2. Retry with Backoff
```python
@retry(max_attempts=3, backoff=exponential)
def call_external_service():
    pass
```

### 3. Graceful Degradation
- Fallback to cached results
- Reduced functionality mode
- Static response serving
- Queue for later processing

## Integration Patterns

### 1. API Gateway Pattern
- Single entry point
- Request routing
- Protocol translation
- Rate limiting
- Authentication

### 2. Adapter Pattern
- External service abstraction
- Consistent internal interface
- Easy service swapping
- Mock implementations for testing

### 3. Message Queue Pattern
- Async communication
- Reliable delivery
- Load leveling
- Temporal decoupling