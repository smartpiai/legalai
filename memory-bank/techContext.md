# Tech Context: Legal AI Platform

## Technology Stack

### Backend Technologies

#### Core Framework
- **Python 3.11**: Latest stable Python for performance improvements
- **FastAPI**: Modern, fast web framework with automatic OpenAPI docs
- **Pydantic**: Data validation and settings management
- **SQLAlchemy 2.0**: ORM with async support
- **Alembic**: Database migration management

#### Async & Background Processing
- **Celery**: Distributed task queue for background jobs
- **Redis**: Message broker and caching layer
- **asyncio**: Async/await for concurrent operations
- **APScheduler**: Scheduled task management

#### AI/ML Stack
- **LangChain**: LLM orchestration and RAG pipeline
- **PyTorch**: Deep learning framework for custom models
- **Transformers**: Hugging Face transformers for NLP
- **spaCy**: Industrial-strength NLP for entity extraction
- **sentence-transformers**: Semantic similarity and embeddings
- **OpenAI API**: GPT-4 for advanced reasoning (with fallback options)

### Frontend Technologies

#### Core Stack
- **React 18**: Latest React with concurrent features
- **TypeScript 4.9+**: Type safety and better DX
- **Vite**: Fast build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **Radix UI**: Unstyled, accessible component primitives

#### State & Data Management
- **Zustand**: Lightweight state management
- **React Query (TanStack Query)**: Server state management
- **React Hook Form**: Performant forms with validation
- **Zod**: Schema validation for TypeScript

#### Visualization & UI
- **D3.js**: Data visualization for analytics
- **React Flow**: Graph visualization for relationships
- **PDF.js**: PDF rendering in browser
- **Monaco Editor**: Code/template editing
- **React Table**: Advanced data tables

### Databases

#### Primary Databases
- **PostgreSQL 15**: Main transactional database
  - JSONB for flexible schema
  - Full-text search capabilities
  - Row-level security for multi-tenancy

- **Neo4j 5**: Graph database for relationships
  - Contract relationships
  - Entity connections
  - Hierarchy mapping

- **Qdrant**: Vector database for embeddings
  - Semantic search
  - Similarity matching
  - RAG retrieval

#### Supporting Databases
- **Redis**: Caching and session storage
  - Session management
  - Rate limiting
  - Pub/sub for real-time features
  - Task queue backend

- **MinIO**: S3-compatible object storage
  - Document storage
  - Version control
  - Backup storage

### Infrastructure

#### Container & Orchestration
- **Docker**: Containerization
- **Docker Compose**: Local development orchestration
- **Kubernetes**: Production orchestration
- **Helm**: Kubernetes package management

#### Cloud Services (Multi-cloud Ready)
- **AWS/GCP/Azure**: Cloud providers
- **S3/GCS/Blob**: Object storage
- **CloudFront/Cloud CDN**: Content delivery
- **Lambda/Cloud Functions**: Serverless computing

#### Monitoring & Observability
- **OpenTelemetry**: Distributed tracing
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **ELK Stack**: Logging (Elasticsearch, Logstash, Kibana)
- **Sentry**: Error tracking

## Development Setup

### Local Development Requirements

#### System Requirements
```yaml
minimum:
  cpu: 4 cores
  ram: 8GB
  disk: 50GB
  os: Linux/macOS/Windows with WSL2

recommended:
  cpu: 8 cores
  ram: 16GB
  disk: 100GB SSD
  gpu: NVIDIA GPU for ML development
```

#### Required Software
```bash
# Core tools
Docker Desktop 24+
Docker Compose 2.20+
Python 3.11+
Node.js 18+ (LTS)
Git 2.40+

# Development tools
VSCode or PyCharm
Postman or Insomnia
pgAdmin or DBeaver
Redis Insight
```

### Environment Configuration

#### Environment Variables Structure
```bash
# Application
APP_ENV=development|staging|production
APP_DEBUG=true|false
APP_SECRET_KEY=<secret>
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/legal_ai
REDIS_URL=redis://localhost:6379/0
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
QDRANT_URL=http://localhost:6333

# Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=<access_key>
MINIO_SECRET_KEY=<secret_key>
MINIO_BUCKET=legal-documents

# AI/ML
OPENAI_API_KEY=<api_key>
EMBEDDING_MODEL=text-embedding-ada-002
LLM_MODEL=gpt-4-turbo-preview
HUGGINGFACE_TOKEN=<token>

# Security
JWT_SECRET_KEY=<secret>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=30
CORS_ORIGINS=http://localhost:3000

# Monitoring
SENTRY_DSN=<dsn>
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### Development Workflow

#### Git Configuration
```bash
# Branch naming
feature/description
bugfix/description
hotfix/description
release/version

# Commit conventions
feat: new feature
fix: bug fix
docs: documentation
style: formatting
refactor: code restructuring
test: test changes
chore: maintenance
```

#### Code Quality Tools
```yaml
backend:
  - black: Code formatting
  - isort: Import sorting
  - flake8: Linting
  - mypy: Type checking
  - pytest: Testing
  - coverage: Test coverage

frontend:
  - prettier: Code formatting
  - eslint: Linting
  - typescript: Type checking
  - jest: Unit testing
  - cypress: E2E testing
```

## Technical Constraints

### Performance Requirements
```yaml
api_response_time:
  simple_query: < 200ms
  complex_query: < 1s
  file_upload: < 3s for 10MB

throughput:
  concurrent_users: 100+
  requests_per_second: 1000+
  documents_per_minute: 50+

availability:
  uptime: 99.9%
  maintenance_window: < 4 hours/month
```

### Security Requirements
```yaml
authentication:
  - JWT with refresh tokens
  - OAuth 2.0 support
  - MFA capability
  - Session timeout

encryption:
  - TLS 1.3 for transit
  - AES-256 for storage
  - Key rotation every 90 days

compliance:
  - GDPR compliant
  - SOC 2 Type II
  - ISO 27001 ready
  - HIPAA capable
```

### Scalability Requirements
```yaml
horizontal_scaling:
  - Stateless services
  - Load balancer ready
  - Auto-scaling policies

data_scaling:
  - 100,000+ documents
  - 10,000+ users
  - 1,000+ concurrent sessions

geographic_distribution:
  - Multi-region capable
  - Data residency support
  - CDN integration
```

## Dependencies

### Backend Dependencies
```python
# Core
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
python-multipart==0.0.6

# Database
sqlalchemy==2.0.23
alembic==1.12.1
asyncpg==0.29.0
redis==5.0.1
neo4j==5.14.0
qdrant-client==1.7.0

# AI/ML
langchain==0.0.350
openai==1.3.0
transformers==4.35.0
torch==2.1.0
sentence-transformers==2.2.2
spacy==3.7.2

# Background Tasks
celery==5.3.4
flower==2.0.1

# Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# Utilities
httpx==0.25.0
python-dateutil==2.8.2
pyyaml==6.0.1
```

### Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "@tanstack/react-query": "^5.0.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0",
    "@radix-ui/react-*": "^1.0.0",
    "tailwindcss": "^3.3.0",
    "d3": "^7.8.0",
    "reactflow": "^11.10.0",
    "pdfjs-dist": "^3.11.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.1.0"
  }
}
```

## Tool Usage Patterns

### Docker Compose Services
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: legal_ai
      POSTGRES_USER: legal_user
      POSTGRES_PASSWORD: legal_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  neo4j:
    image: neo4j:5-community
    environment:
      NEO4J_AUTH: neo4j/password
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    volumes:
      - neo4j_data:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
```

### API Development Patterns
```python
# FastAPI endpoint pattern
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/contracts", tags=["contracts"])

@router.post("/", response_model=ContractResponse)
async def create_contract(
    contract: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Implementation
    pass
```

### Frontend API Integration
```typescript
// API service pattern
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const contractService = {
  create: (data: ContractCreate) => api.post('/contracts', data),
  get: (id: string) => api.get(`/contracts/${id}`),
  list: (params?: ContractQuery) => api.get('/contracts', { params }),
};
```

## Testing Strategy

### Backend Testing
```python
# pytest configuration
[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
python_files = "test_*.py"
python_classes = "Test*"
python_functions = "test_*"
addopts = "-ra -q --strict-markers --cov=app --cov-report=html"
```

### Frontend Testing
```javascript
// Jest configuration
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverage: {
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
};
```

## Deployment Configuration

### Production Requirements
```yaml
infrastructure:
  load_balancer: nginx or AWS ALB
  ssl_certificate: Let's Encrypt or ACM
  cdn: CloudFront or Cloudflare
  backup: Daily automated backups
  monitoring: 24/7 with alerts

security:
  firewall: WAF enabled
  ddos_protection: CloudFlare or AWS Shield
  vulnerability_scanning: Weekly automated scans
  penetration_testing: Quarterly

performance:
  caching: Multi-layer (CDN, Redis, Application)
  compression: Gzip/Brotli enabled
  optimization: Code splitting, lazy loading
  database: Connection pooling, query optimization
```