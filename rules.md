# Legal AI Platform Safety Rules and Constraints

## Critical Legal Data Safety Rules

1. **NEVER expose sensitive legal data** - All contract data must be encrypted and access-controlled
2. **NEVER mix tenant data** - Complete isolation between different organizations
3. **NEVER skip audit logging** - Every data access must be tracked for compliance
4. **NEVER bypass authentication** - All endpoints require proper JWT validation
5. **NEVER deploy without security review** - OWASP top 10 compliance required

## Project-Specific Rules

### Memory Bank Integrity

- **ALWAYS read ALL memory bank files** before starting major feature work
- **ALWAYS update memory bank files** after completing features
- **NEVER delete or rename memory bank files**
- **MAINTAIN consistency** between memory bank documentation and implementation
- **TRACK progress** in progress.md with detailed status updates

### Code Quality Standards

- **ALWAYS write tests first** - TDD is mandatory (RED → GREEN → REFACTOR)
- **ALWAYS maintain 85% test coverage** minimum for backend services
- **ALWAYS use type hints** in Python and TypeScript strictly
- **ALWAYS handle errors explicitly** - No silent failures
- **ALWAYS document API endpoints** with OpenAPI specifications

### Multi-Tenancy Management

- **ENFORCE tenant isolation** at database, storage, and cache levels
- **USE tenant_id** in all database queries and API operations
- **VALIDATE tenant access** in middleware before processing requests
- **SEPARATE storage buckets** per tenant in MinIO
- **ISOLATE vector collections** per tenant in Qdrant

### API Design Standards

- **FOLLOW RESTful principles** - proper HTTP verbs and status codes
- **VERSION all endpoints** - /api/v1/ prefix required
- **IMPLEMENT pagination** for list endpoints (limit/offset or cursor)
- **USE consistent error format** - RFC 7807 Problem Details
- **REQUIRE authentication** except for health checks and public endpoints

### Test-Driven Development (TDD) - MANDATORY

- **RED PHASE**: Write failing tests FIRST - no exceptions
  - Unit tests for each service method
  - Integration tests for API endpoints
  - E2E tests for critical workflows
  - All tests must fail initially
- **GREEN PHASE**: Write MINIMAL code to make tests pass
  - No extra features or optimizations
  - Focus only on passing tests
  - Simplest implementation that works
- **REFACTOR PHASE**: Improve code while tests stay green
  - Optimize performance
  - Clean up code structure
  - All tests must remain passing
- **NO CODE WITHOUT TESTS** - Tests must exist before implementation
- **NO SKIPPING PHASES** - Must complete red-green-refactor cycle

### Development Workflow

- **FOLLOW TDD strictly** - Red → Green → Refactor for every feature
- **CREATE services in layers** - Repository → Service → API endpoint
- **WRITE comprehensive tests** before implementation
- **PROFILE performance** for critical paths
- **DOCUMENT all services** with docstrings and type hints
- **VALIDATE multi-tenant isolation** in every data operation

### Security & Compliance

- **IMPLEMENT RBAC** - Role-based access control on all endpoints
- **ENCRYPT sensitive data** - AES-256 for documents at rest
- **SANITIZE all inputs** - Prevent SQL injection and XSS
- **LOG security events** - Authentication, authorization, data access
- **COMPLY with GDPR** - Data privacy and right to deletion
- **MAINTAIN SOC 2 standards** - Security controls and audit trails

### File Length Restrictions - STRICT ENFORCEMENT

- **MAXIMUM 750 lines per file** - No exceptions for hand-written code
- **Service files**: 750 lines maximum
- **Component files**: 750 lines maximum
- **Test files**: 750 lines maximum (split if needed)
- **When approaching 600 lines**: Start planning refactoring
- **Refactoring strategies**:
  - Split into sub-services or sub-components
  - Extract helper functions to utilities
  - Separate concerns into different modules
  - Create base classes for shared functionality
  - Move complex logic to dedicated services
- **Exceptions**: Only for generated code (migrations, OpenAPI specs)
- **ENFORCEMENT**: Code review must reject if limits exceeded

### Communication Standards

- **USE clear service names** - describe what they do
- **DOCUMENT service dependencies** clearly
- **SPECIFY API contracts** with Pydantic schemas
- **EXPLAIN business logic** in comments for complex operations

## Working Directory Rules

- **WORK ONLY within the legal-ai-platform directory**
- **CREATE services in appropriate directories** (services/, models/, schemas/)
- **USE Alembic for database migrations** - never modify schema directly
- **MAINTAIN separation** between business logic and API layer

## Build Rules

- **USE Docker for all services** - ensure consistency across environments
- **COMPILE frontend with Vite** - optimized production builds
- **ENABLE all Python type checking** with mypy
- **BUILD in both development and production** modes for testing

## Testing Rules - STRICT COVERAGE REQUIREMENTS

### Mandatory Test Coverage - ALL THREE TYPES REQUIRED

#### UNIT TESTS (Required for EVERY service/component)

- **Minimum 85% code coverage** for backend services
- **Minimum 80% code coverage** for frontend components
- Test all edge cases and error conditions
- Test both success and failure paths
- Mock external dependencies appropriately
- Test individual methods in isolation
- Validate all return values and error codes

#### INTEGRATION TESTS (Required for ALL API endpoints)

- Test complete request/response cycle
- Test authentication and authorization
- Test multi-tenant data isolation
- Test database transactions
- Test error handling and validation
- Test pagination and filtering
- Test rate limiting
- Verify RBAC permissions

#### END-TO-END TESTS (Required for critical workflows)

- Complete user workflows (login → action → result)
- Contract creation and approval flow
- Document upload and extraction pipeline
- Template generation workflow
- Search and retrieval operations
- Multi-user collaboration scenarios
- Performance under load
- Security penetration testing

### Additional Test Requirements

- **SECURITY TESTS**: Required for ALL endpoints
  - Authentication bypass attempts
  - Authorization boundary testing
  - SQL injection prevention
  - XSS protection validation
  - CSRF token validation
  - Rate limiting enforcement

- **PERFORMANCE TESTS**: Required for critical paths
  - Response time < 200ms for simple queries
  - Response time < 1s for complex operations
  - Document processing < 3s
  - Concurrent user load testing
  - Database query optimization

- **MULTI-TENANT TESTS**: Required for all data operations
  - Verify complete data isolation
  - Test cross-tenant access prevention
  - Validate tenant-specific configurations
  - Check storage bucket isolation

### Testing Workflow - TDD MANDATORY

1. **RED PHASE - Write Tests First**:
   - Write unit tests for service logic
   - Write integration tests for APIs
   - Write E2E tests for workflows
   - ALL tests must fail initially

2. **GREEN PHASE - Minimal Implementation**:
   - Implement basic functionality
   - Make unit tests pass
   - Make integration tests pass
   - Make E2E tests pass
   - No optimizations yet

3. **REFACTOR PHASE - Optimize**:
   - Improve code structure
   - Add error handling
   - Optimize database queries
   - Enhance performance
   - All tests must stay green

4. **COVERAGE PHASE - Validate**:
   - Run coverage reports
   - Ensure 85% minimum coverage
   - Add tests for uncovered paths
   - Document test scenarios

### Test Execution Commands

- `pytest` - Run backend tests
- `pytest --cov=app --cov-report=html` - Coverage report
- `npm test` - Run frontend tests
- `npm run test:coverage` - Frontend coverage
- `npm run test:e2e` - End-to-end tests

### Test Organization Requirements

- **Unit tests**: `tests/unit/` or alongside implementation
- **Integration tests**: `tests/integration/` directory
- **E2E tests**: `tests/e2e/` directory
- **Test fixtures**: `tests/fixtures/` for test data
- **Test utilities**: `tests/utils/` for helpers
- **Test naming**: test_[feature]_[scenario]_[expected_result]
- **Test independence**: Each test must be runnable in isolation
- **Test determinism**: No random or time-dependent behavior
- **Test speed**: Unit <100ms, integration <1s, E2E <10s

### BLOCKING CRITERIA - ZERO TOLERANCE

- **NO CODE** without tests written first (TDD Red phase required)
- **NO FILES** exceeding 750 lines (refactor immediately)
- **NO MERGE** without:
  - Unit tests passing (>85% coverage)
  - Integration tests passing (all endpoints covered)
  - E2E tests passing (critical workflows validated)
  - Security tests passing (auth, RBAC, isolation)
  - Multi-tenant isolation verified
  - Code review approved
  - Documentation updated
- **NO DEPLOYMENT** without:
  - All tests passing in CI/CD
  - Security scan completed
  - Performance benchmarks met
  - Database migrations tested
  - Rollback plan documented
- **NO SKIPPING** any phase of TDD
- **NO EXCEPTIONS** to these rules

## Error Handling

- **USE structured error responses** - consistent format
- **IMPLEMENT retry logic** for transient failures
- **LOG all errors** with context and stack traces
- **PROVIDE meaningful error messages** for users
- **HANDLE database connection failures** gracefully

## Performance Considerations

- **OPTIMIZE database queries** - use indexes and limit results
- **IMPLEMENT caching** with Redis for frequently accessed data
- **USE pagination** for large result sets
- **BATCH operations** when processing multiple items
- **PROFILE before optimizing** - measure, don't guess

## Phase 1 Specific Rules

### Current Focus: Foundation & MVP (Weeks 3-4)

- **PRIORITIZE core CLM features** - contracts, templates, workflows
- **IMPLEMENT basic RAG** - document search and retrieval
- **VALIDATE multi-tenancy** - complete isolation verified
- **ACHIEVE MVP milestones** - demo-ready features
- **OPTIMIZE later** - functionality first, performance second

### Performance Requirements

- API response time: <200ms for simple queries
- Document processing: <3 seconds per document
- Search results: <1 second for full-text search
- Concurrent users: Support 100+ simultaneous users
- Database connections: Pool management required

## Security Best Practices

- **NEVER hardcode secrets** - use environment variables
- **NEVER log sensitive data** - mask PII and credentials
- **ALWAYS validate input** - sanitize and validate all user input
- **ALWAYS use HTTPS** - enforce TLS for all communications
- **ALWAYS hash passwords** - bcrypt with appropriate rounds
- **ALWAYS validate file uploads** - check type, size, and content
- **ALWAYS use parameterized queries** - prevent SQL injection
- **ALWAYS implement rate limiting** - prevent abuse
- **ALWAYS audit data access** - comprehensive logging
- **ALWAYS encrypt sensitive fields** - data at rest protection

## Remember

- This is an enterprise legal platform - security and compliance are critical
- Every feature must support multi-tenancy from the start
- AI accuracy is important but data security is paramount
- Test coverage ensures reliability for legal operations
- Documentation is required for maintainability