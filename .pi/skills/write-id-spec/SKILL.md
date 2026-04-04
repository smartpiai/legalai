---
name: write-id-spec
description: Guide through creating an Interface Design Specification with API contracts, Pydantic schemas, streaming protocols, and versioning strategy
---

# Write an Interface Design Specification (ID Spec)

You are helping the user create an ID Spec. The ID Spec answers: **"What does the API contract look like?"** It is the critical lateral document — the contract between backend producers and frontend consumers.

## Before You Start

1. Read the template: `docs/templates/ID_SPEC_TEMPLATE.md`
2. Check for the upstream Tech Spec — the API design should implement the architecture
3. Identify producers and consumers of this interface

## Authorship

- **Primary author**: Backend Engineer who owns the API
- **Co-contributors**: Frontend Engineer (as consumer-reviewer)
- **Approvers**: Tech Lead + API consumers
- **Consumers**: Frontend engineers, integration partners, QA (contract tests)

## Naming

```
docs/phase-{N}/{N.X}_id-spec_{api-name}.md
```

## Workflow

### 1. Overview
Identify producer and consumer components.

### 2. Global API Policies
Set: base URL, content-type, body limits, timeouts, CORS, rate limiting.
Rate limits need per-tenant, per-user, and global scopes.

### 3. Endpoints
For EACH endpoint, specify:
- Method + path, description, auth, authorization, rate limit
- Idempotency key behavior (for mutating endpoints)
- Request: headers, path params, query params, body (JSON + Pydantic schema)
- Response: success body (JSON + Pydantic schema)
- Errors: status code, error code, when it occurs, response body
- Include realistic example payloads, not just type annotations

### 4. Pagination
Use cursor-based pagination. Define the PaginatedResponse envelope.

### 5. Streaming (if applicable)
Define SSE event types with example payloads and client handling code.

### 6. WebSocket (if applicable)
Define message types, lifecycle diagram, reconnection strategy.

### 7. Data Models
Define all Pydantic models with field types, validation rules, and examples.

### 8-11. Remaining Sections
Complete: Tool Interfaces, Webhooks, Versioning/Deprecation, Related Documents.

## Quality Checklist

- [ ] Every endpoint has both JSON example AND Pydantic schema
- [ ] Error responses are exhaustive (not just 400/500)
- [ ] Idempotency keys are specified for all mutating endpoints
- [ ] Rate limits are defined per-tenant, per-user, and global
- [ ] Pagination uses cursor-based pattern
- [ ] Streaming events have defined types and client handling examples
- [ ] Versioning and deprecation strategy is defined
- [ ] A frontend engineer has reviewed this as a consumer
- [ ] Tech Spec is linked in Related Documents
