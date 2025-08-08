# CLAUDE.md - AI Assistant Context for Legal AI Platform

## Project Overview
You are working on an enterprise Legal AI Platform that combines Contract Lifecycle Management (CLM) with advanced AI capabilities. This document provides essential context and guidelines for development.

## How to Use This Document
1. **Always load this file first** when starting a new coding session
2. **Reference Memory Bank** files for current project state
3. **Follow TDD best practices** from the prompts/ directory
4. **Update progress.md** as tasks are completed

## Memory Bank Structure

### Core Context Files
```
memory-bank/
├── projectbrief.md      # Project vision, requirements, success metrics
├── productContext.md    # Market analysis, user personas, product principles  
├── activeContext.md     # Current sprint, immediate tasks, blockers
├── systemPatterns.md    # Architecture decisions, design patterns
├── techContext.md       # Tech stack, environments, configurations
└── progress.md          # Comprehensive implementation checklist (1000+ items)
```

### Loading Order
1. **Start with**: `activeContext.md` - Current state and immediate tasks
2. **Reference**: `systemPatterns.md` - Architecture patterns to follow
3. **Check**: `progress.md` - Find next implementation items
4. **Consult**: `techContext.md` - Technical details and setup

## Coding Best Practices

### TDD Methodology (Red-Green-Refactor)
We follow strict Test-Driven Development for all features:

```
prompts/
├── react.md    # React/TypeScript component testing
├── python.md   # FastAPI backend testing
├── graph.md    # Neo4j/GraphRAG testing
└── db.md       # Multi-database testing
```

### Development Workflow

#### 1. Before Starting Any Feature
```bash
# Load context
cat memory-bank/activeContext.md

# Check relevant TDD practices
cat prompts/[react|python|graph|db].md

# Find task in progress tracker
grep -A 5 "task-name" memory-bank/progress.md
```

#### 2. Implementation Process
1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve while keeping tests green
4. **UPDATE**: Mark item complete in progress.md

#### 3. After Completing Feature
```bash
# Update progress
edit memory-bank/progress.md  # Mark items complete

# Update active context if needed
edit memory-bank/activeContext.md  # Update current state

# Run all tests
npm test           # Frontend
pytest            # Backend
```

## Project Architecture

### System Overview
```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         React 18 + TypeScript + Tailwind         │
└─────────────┬───────────────────────────────────┘
              │ REST API + WebSocket
┌─────────────▼───────────────────────────────────┐
│                   Backend                        │
│            FastAPI + Python 3.11                 │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │   Auth       │   Business    │      AI      │ │
│  │   Service    │   Services    │   Services   │ │
│  └──────────────┴──────────────┴──────────────┘ │
└─────────────┬───────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────┐
│                  Data Layer                      │
│  PostgreSQL │ Neo4j │ Qdrant │ Redis │ MinIO    │
└─────────────────────────────────────────────────┘
```

### Key Design Patterns
- **Repository Pattern**: Data access abstraction
- **Service Layer**: Business logic encapsulation
- **Factory Pattern**: Object creation
- **Strategy Pattern**: AI model selection
- **Observer Pattern**: Real-time updates
- **Saga Pattern**: Distributed transactions

## Technology Stack

### Backend
- **Framework**: FastAPI 0.104+
- **Language**: Python 3.11+
- **ORM**: SQLAlchemy 2.0+
- **Task Queue**: Celery + Redis
- **API Docs**: OpenAPI/Swagger

### Frontend
- **Framework**: React 18
- **Language**: TypeScript 5+
- **State**: Zustand + React Query
- **UI**: Tailwind CSS + Headless UI
- **Forms**: React Hook Form + Zod

### Databases
- **Primary**: PostgreSQL 15 (multi-tenant)
- **Graph**: Neo4j 5 (relationships)
- **Vector**: Qdrant (embeddings)
- **Cache**: Redis 7 (sessions/cache)
- **Storage**: MinIO (documents)

### AI/ML
- **LLMs**: OpenAI GPT-4, Claude 3
- **Embeddings**: OpenAI Ada-002
- **GraphRAG**: Custom implementation
- **HRM**: Hierarchical Reasoning Model

## Current Development Phase

**Phase 1: Foundation & MVP (Weeks 1-8)**
- Week 1-2: Infrastructure Setup ← CURRENT
- Week 3-4: Core Contract Management
- Week 5-6: Basic AI Integration
- Week 7-8: Multi-tenancy Implementation

## Critical Implementation Paths

### 1. Authentication & Authorization
```python
# Follow memory-bank/systemPatterns.md#authentication-flow
# Test with prompts/python.md#multi-tenancy-testing
```

### 2. Contract Processing Pipeline
```python
# 1. Upload → 2. Extract → 3. Analyze → 4. Store → 5. Index
# See systemPatterns.md#contract-processing-pipeline
```

### 3. AI Integration
```python
# RAG Pipeline: Query → Embed → Search → Retrieve → Generate
# GraphRAG: Query → Graph Context → Enhanced Retrieval → Generate
# See systemPatterns.md#ai-integration-patterns
```

## Multi-Tenancy Requirements

### Data Isolation
- **Database**: Row-level security (RLS)
- **Storage**: Tenant-prefixed paths
- **Cache**: Tenant-namespaced keys
- **Search**: Filtered by tenant_id

### Testing Requirements
```python
# Every feature MUST test tenant isolation
@pytest.mark.asyncio
async def test_tenant_isolation():
    # Test that tenant A cannot access tenant B's data
    pass
```

## Performance Targets

### API Response Times
- Simple queries: < 200ms
- Complex queries: < 1s
- Document upload: < 5s
- AI analysis: < 10s

### Scalability
- 1000+ concurrent users
- 100k+ contracts per tenant
- 10M+ documents searchable
- 99.9% uptime SLA

## Security Requirements

### Must Implement
- [x] JWT authentication
- [x] Role-based access control (RBAC)
- [x] Multi-tenant isolation
- [x] Audit logging
- [ ] End-to-end encryption
- [ ] GDPR compliance
- [ ] SOC 2 compliance

## Development Commands

### Backend
```bash
# Start services
docker-compose up -d

# Run backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Run tests
pytest tests/ --cov=app --cov-report=html

# Database migrations
alembic upgrade head
```

### Frontend
```bash
# Install dependencies
cd frontend
npm install

# Start development
npm run dev

# Run tests
npm test
npm run test:coverage

# Build production
npm run build
```

### Docker
```bash
# Full stack
docker-compose up

# Individual services
docker-compose up postgres redis neo4j qdrant minio
```

## Testing Strategy

### Test Pyramid
```
        /\        E2E Tests (10%)
       /  \       - Critical user journeys
      /    \      - Full system tests
     /------\     
    /        \    Integration Tests (30%)
   /          \   - API endpoints
  /            \  - Service interactions
 /              \ - Database operations
/________________\
Unit Tests (60%)
- Business logic
- Utilities
- Components
```

### Coverage Requirements
- **Overall**: 85% minimum
- **Business Logic**: 100%
- **API Endpoints**: 100%
- **Critical Paths**: 100%

## Quick Reference

### File Locations
```bash
# Backend
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── services/     # Business logic
│   ├── repositories/ # Data access
│   ├── models/       # Database models
│   └── core/         # Core utilities

# Frontend
frontend/
├── src/
│   ├── components/   # React components
│   ├── pages/        # Page components
│   ├── hooks/        # Custom hooks
│   ├── services/     # API services
│   └── stores/       # State management
```

### Common Tasks

#### Add New API Endpoint
1. Write test first (`tests/api/test_new_endpoint.py`)
2. Create endpoint (`app/api/v1/new_endpoint.py`)
3. Add service layer (`app/services/new_service.py`)
4. Update router (`app/api/v1/__init__.py`)

#### Add New Component
1. Write test first (`src/components/__tests__/NewComponent.test.tsx`)
2. Create component (`src/components/NewComponent.tsx`)
3. Add to exports (`src/components/index.ts`)

#### Add Database Migration
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Important Reminders

### Always
- ✅ Write tests first (TDD)
- ✅ Check tenant isolation
- ✅ Update progress.md
- ✅ Follow design patterns
- ✅ Consider performance
- ✅ Document complex logic

### Never
- ❌ Skip tests
- ❌ Hardcode credentials
- ❌ Mix tenant data
- ❌ Ignore error handling
- ❌ Create tight coupling
- ❌ Bypass security checks

## Getting Help

### Resources
- Project documentation: `/docs`
- API documentation: `http://localhost:8000/docs`
- Memory Bank: `/memory-bank`
- TDD Guides: `/prompts`

### Debugging
```python
# Backend debugging
import ipdb; ipdb.set_trace()

# Frontend debugging
console.log('Debug:', variable);
debugger;
```

### Performance Profiling
```python
# Backend
import cProfile
cProfile.run('function_to_profile()')

# Frontend
React DevTools Profiler
```

## Next Steps

1. **Check current tasks**: `cat memory-bank/activeContext.md`
2. **Find next item**: `grep "Week 1" memory-bank/progress.md`
3. **Load TDD guide**: `cat prompts/[relevant].md`
4. **Start coding**: Follow Red-Green-Refactor cycle
5. **Update progress**: Mark completed items

---

*Remember: This is a living document. Update it as the project evolves.*

**Last Updated**: Phase 1, Week 1
**Version**: 1.0.0