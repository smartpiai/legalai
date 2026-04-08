# Interface Design Specification

> **Title**: {API, schema, or protocol name}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | In Review | Approved
> **Version**: {1.0}

> Include sections relevant to your interface. Mark inapplicable sections with `N/A — [reason]` rather than deleting them.

---

## 1. Overview

{What interface is being defined? Who are the consumers and producers?}

| Role | Component |
|------|-----------|
| **Producer** | {e.g., Backend agent service} |
| **Consumer** | {e.g., Frontend, other backend services} |

## 2. Global API Policies

| Policy | Value | Notes |
|--------|-------|-------|
| Base URL | `{e.g., /api/v1}` | {e.g., Versioned via URL path} |
| Content-Type | `application/json` | {e.g., Multipart for file uploads} |
| Max request body | {e.g., 10 MB} | {e.g., 50 MB for document upload endpoints} |
| Max response body | {e.g., 5 MB} | {e.g., Paginate if larger} |
| Default timeout | {e.g., 30s} | {e.g., 120s for AI processing endpoints} |
| CORS allowed origins | {e.g., `https://*.legalai.com`, `http://localhost:3000` (dev)} | |
| CORS allowed methods | {e.g., GET, POST, PUT, DELETE, OPTIONS} | |
| CORS allowed headers | {e.g., Authorization, X-Tenant-ID, Content-Type, Idempotency-Key} | |

### Rate Limiting Strategy

| Scope | Limit | Window | Burst | Response |
|-------|-------|--------|-------|----------|
| Per tenant (global) | {e.g., 1000 req} | {e.g., 1 min} | {e.g., 50 req burst} | `429` with `Retry-After` header |
| Per tenant per endpoint | {e.g., varies by endpoint — see endpoint definitions} | | | |
| Per user | {e.g., 200 req} | {e.g., 1 min} | {e.g., 20 req burst} | `429` with `Retry-After` header |
| Global (all tenants) | {e.g., 10,000 req} | {e.g., 1 min} | {e.g., 500 req burst} | `503 Service Unavailable` |

Rate limit headers included in every response:
- `X-RateLimit-Limit`: Maximum requests in window
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: UTC epoch seconds when window resets

## 3. API Endpoints

### `{METHOD} /api/v1/{path}`

**Description**: {What this endpoint does}

**Authentication**: {Bearer token / API key / None}

**Authorization**: {Required role / permission}

**Rate Limit**: {e.g., 10 req/min per tenant}

**Idempotency**: {If mutating — describe idempotency key behavior, or "N/A" for GET/safe methods}

> For mutating endpoints, include an `Idempotency-Key` header. If a request with the same key is replayed within {TTL, e.g., 24 hours}, the server returns the original response without re-executing the operation.

#### Request

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer {token}` |
| `X-Tenant-ID` | Yes | Tenant identifier |
| `Idempotency-Key` | Conditional | Required for POST/PUT/DELETE. UUID v4. |

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `{param}` | `string` | {description} |

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `{param}` | `string` | `{default}` | {description} |

**Request Body:**
```json
{
  "field_name": "type — description",
  "nested": {
    "field": "type — description"
  }
}
```

**Pydantic Schema:**
```python
class RequestModel(BaseModel):
    field_name: str = Field(..., description="description")
    nested: NestedModel

    model_config = ConfigDict(
        json_schema_extra={"example": {}}
    )
```

#### Response

**Success (200):**
```json
{
  "field_name": "type — description",
  "metadata": {
    "processing_time_ms": 1234,
    "model_version": "claude-sonnet-4-6"
  }
}
```

**Pydantic Schema:**
```python
class ResponseModel(BaseModel):
    field_name: str
    metadata: ResponseMetadata

    model_config = ConfigDict(
        json_schema_extra={"example": {}}
    )
```

#### Errors

| Status | Code | Description | Response Body |
|--------|------|-------------|---------------|
| 400 | `INVALID_INPUT` | {when} | `{"error": "code", "detail": "message"}` |
| 401 | `UNAUTHORIZED` | {when} | `{"error": "code", "detail": "message"}` |
| 404 | `NOT_FOUND` | {when} | `{"error": "code", "detail": "message"}` |
| 409 | `CONFLICT` | {Idempotency key reused with different payload} | `{"error": "code", "detail": "message"}` |
| 422 | `VALIDATION_ERROR` | {when} | `{"error": "code", "detail": [...]}` |
| 429 | `RATE_LIMITED` | {when} | `{"error": "code", "retry_after": seconds}` |
| 500 | `INTERNAL_ERROR` | {when} | `{"error": "code", "detail": "message"}` |

{Repeat the endpoint section for each endpoint.}

---

## 4. Pagination

> Standard pagination pattern for list endpoints. Use cursor-based pagination for consistency and performance.

### Cursor-Based (preferred)

**Request:**
```
GET /api/v1/{resource}?limit=20&cursor={opaque_cursor}
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | `int` | `20` | Items per page (max 100) |
| `cursor` | `string` | `null` | Opaque cursor from previous response. Omit for first page. |

**Response Envelope:**
```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIzfQ==",
    "has_more": true,
    "total_count": 1542
  }
}
```

**Pydantic Schema:**
```python
class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: PaginationMeta

class PaginationMeta(BaseModel):
    next_cursor: str | None = None
    has_more: bool
    total_count: int | None = None  # Optional, expensive for large datasets
```

---

## 5. Streaming Responses

> For long-running AI operations that produce incremental output.

### Server-Sent Events (SSE)

**Endpoint**: `GET /api/v1/{resource}/stream`

**Content-Type**: `text/event-stream`

**Event Types:**
```
event: chunk
data: {"type": "chunk", "content": "partial text...", "index": 0}

event: tool_call
data: {"type": "tool_call", "tool": "search_contracts", "input": {...}}

event: tool_result
data: {"type": "tool_result", "tool": "search_contracts", "output": {...}}

event: done
data: {"type": "done", "usage": {"input_tokens": 1500, "output_tokens": 300}}

event: error
data: {"type": "error", "code": "TIMEOUT", "detail": "Agent exceeded time budget"}
```

**Client handling:**
```typescript
const source = new EventSource('/api/v1/agents/stream?id=xxx');
source.addEventListener('chunk', (e) => { /* append to output */ });
source.addEventListener('done', (e) => { /* finalize */ source.close(); });
source.addEventListener('error', (e) => { /* handle error */ source.close(); });
```

---

## 6. WebSocket Protocols (if applicable)

### `WS /api/v1/{path}`

**Connection**: {Auth mechanism, handshake params}

**Client → Server Messages:**
```json
{
  "type": "invoke",
  "agent_type": "extraction",
  "payload": { }
}
```

**Server → Client Messages:**
```json
{
  "type": "chunk | tool_call | result | error",
  "data": { }
}
```

**Lifecycle:**
```
Client                          Server
  |--- connect (auth header) ---->|
  |<--- connection_ack -----------|
  |--- invoke (payload) --------->|
  |<--- chunk (streaming) --------|
  |<--- tool_call (tool name) ----|
  |<--- chunk (more streaming) ---|
  |<--- result (final output) ----|
  |--- close -------------------->|
```

---

## 7. Data Models / Schemas

### {Model Name}

```python
class ContractExtraction(BaseModel):
    """Structured output from the ExtractionAgent."""

    parties: list[Party]
    effective_date: date | None
    expiration_date: date | None
    contract_type: ContractType
    total_value: Decimal | None
    currency: str = "USD"
    key_clauses: list[Clause]
    obligations: list[Obligation]
    risk_flags: list[RiskFlag]

    model_config = ConfigDict(
        json_schema_extra={
            "example": { }
        }
    )
```

{Repeat for each model.}

---

## 8. Tool Interfaces (for Agent SDK tools)

> Mark `N/A` if this spec does not involve agent tools.

### `{tool_name}`

**Description**: {What the tool does — this becomes the tool description the agent sees}

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `{param}` | `{type}` | Yes/No | {description} |

**Returns:**
```python
class ToolResult(BaseModel):
    field: type
```

**Example Call:**
```json
{
  "tool": "search_contracts",
  "input": {
    "query": "indemnification clauses in vendor agreements",
    "filters": {"contract_type": "MSA"},
    "top_k": 5
  }
}
```

**Example Response:**
```json
{
  "results": [
    {"contract_id": "...", "clause_text": "...", "score": 0.92}
  ]
}
```

{Repeat for each tool.}

---

## 9. Webhook Callbacks (if applicable)

> For long-running async operations (>10s) where the client cannot hold a connection open. Mark `N/A` if all operations are synchronous or use SSE/WebSocket.

### Registration

```
POST /api/v1/webhooks
{
  "url": "https://customer.example.com/callbacks",
  "events": ["extraction.completed", "extraction.failed"],
  "secret": "{shared secret for HMAC verification}"
}
```

### Delivery

| Aspect | Detail |
|--------|--------|
| Method | POST |
| Signature header | `X-Webhook-Signature: sha256={HMAC of body using shared secret}` |
| Retry policy | {e.g., 3 retries with exponential backoff: 10s, 60s, 300s} |
| Timeout | {e.g., 5s — if endpoint doesn't respond, retry} |
| Idempotency | {e.g., Each delivery includes `X-Webhook-ID`; clients should deduplicate} |

### Event Payloads

```json
{
  "id": "wh_abc123",
  "type": "extraction.completed",
  "timestamp": "2026-03-31T12:00:00Z",
  "tenant_id": "tenant_xyz",
  "data": {
    "contract_id": "...",
    "result_url": "/api/v1/extractions/{id}"
  }
}
```

## 10. Versioning & Compatibility

### Versioning Strategy

| Aspect | Approach |
|--------|----------|
| Versioning method | {e.g., URL path (`/api/v1/`, `/api/v2/`)} |
| Breaking change definition | {e.g., Removing a field, changing a field type, removing an endpoint} |
| Non-breaking changes | {e.g., Adding optional fields, adding new endpoints, adding enum values} |

### Version History

| Version | Changes | Backward Compatible |
|---------|---------|---------------------|
| 1.0 | Initial release | N/A |
| {1.1} | {change description} | {Yes/No} |

### Deprecation Flow

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Mark field/endpoint as deprecated in OpenAPI schema | Immediately |
| 2 | Add `Sunset: {date}` and `Deprecation: true` response headers | Same release |
| 3 | Log usage of deprecated features per tenant | Ongoing |
| 4 | Notify consumers via changelog and direct outreach | 30 days before removal |
| 5 | Remove deprecated feature | Minimum 2 releases / 90 days after deprecation |

## 11. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Test Spec | [Test Spec](../phase-{X}/{X.X}_test-spec_{name}.md) |
| OpenAPI docs | {e.g., `http://localhost:8000/docs`} |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial draft | {name} |
| {YYYY-MM-DD} | {e.g., Added streaming endpoints} | {name} |
| {YYYY-MM-DD} | {e.g., Approved} | {name} |
