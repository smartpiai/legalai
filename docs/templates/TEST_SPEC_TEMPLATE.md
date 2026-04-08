# Test Specification

> **Title**: {feature or component name}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | In Review | Approved

---

## 1. Scope

{What is being tested? What is explicitly NOT being tested?}

### In Scope
- {Component/feature 1}
- {Component/feature 2}

### Out of Scope
- {e.g., "UI visual appearance — covered by visual regression"}
- {e.g., "Performance benchmarks — see [Perf Spec](../phase-{X}/{X.X}_perf-spec_{name}.md)"}

## 2. How to Run

### Prerequisites

| Requirement | Setup Command |
|-------------|---------------|
| {e.g., Docker running} | `docker compose up -d postgres redis qdrant` |
| {e.g., Python venv} | `python -m venv venv && source venv/bin/activate && pip install -r requirements-dev.txt` |
| {e.g., Test env vars} | `cp .env.test .env` |

### Commands

```bash
# Run all tests for this feature
pytest tests/{feature}/ -v

# Run with coverage
pytest tests/{feature}/ --cov=app/{feature} --cov-report=html

# Run specific test layer
pytest tests/{feature}/unit/ -v           # Unit only
pytest tests/{feature}/integration/ -v    # Integration only

# Frontend (if applicable)
npm test -- --testPathPattern="{feature}"
```

## 3. CI Pipeline Integration

| Test Suite | Trigger | Timeout | Required to Merge? |
|------------|---------|---------|-------------------|
| Unit tests | Every PR | 5 min | Yes |
| Integration tests | Every PR | 15 min | Yes |
| E2E / smoke tests | Nightly + release | 30 min | No (nightly), Yes (release) |
| AI eval harness | Nightly | 60 min | No (advisory, blocks if regression > threshold) |

## 4. Coverage Targets

| Layer | Target | Measurement |
|-------|--------|-------------|
| Unit | {e.g., 90%} | {e.g., pytest-cov / vitest --coverage} |
| Integration | {e.g., All API endpoints} | {e.g., Endpoint hit count} |
| E2E | {e.g., Critical paths only} | {e.g., Playwright test count} |

## 5. Test Environment

| Dependency | How Provided |
|------------|-------------|
| PostgreSQL | {Docker container / CI service / mock} |
| Redis | {Docker container / fakeredis} |
| Neo4j | {Docker container / mock} |
| Qdrant | {Docker container / in-memory} |
| Anthropic API | {Mock / recorded responses / live (with cost cap)} |

## 6. Test Cases

### Unit Tests

| ID | Test Case | Preconditions | Input | Expected Output | Cleanup | Priority |
|----|-----------|---------------|-------|-----------------|---------|----------|
| UT-01 | {e.g., "ExtractionAgent returns ContractExtraction for valid PDF"} | {e.g., Mock LLM client configured} | {e.g., Sample PDF bytes} | {e.g., Pydantic model with all fields populated} | {e.g., None} | P0 |
| UT-02 | {e.g., "ExtractionAgent handles empty document"} | {e.g., Same as UT-01} | {e.g., Empty bytes} | {e.g., Error response with reason} | {e.g., None} | P1 |

### Integration Tests

| ID | Test Case | Preconditions | Services Involved | Expected Behavior | Cleanup | Priority |
|----|-----------|---------------|-------------------|-------------------|---------|----------|
| IT-01 | {e.g., "search_contracts tool returns results from Qdrant"} | {e.g., Qdrant seeded with test fixtures} | {Qdrant, embedding service} | {e.g., Top-5 results with score > 0.7} | {e.g., Delete test collection} | P0 |

### Regression Tests

| ID | Test Case | What Could Break | Verification |
|----|-----------|------------------|-------------|
| RT-01 | {e.g., "RAG retrieval recall after LangChain slim-down"} | {Retrieval quality} | {recall@10 >= baseline} |

### Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-01 | {e.g., "Agent exceeds token budget mid-response"} | {e.g., Graceful termination with partial result} |
| EC-02 | {e.g., "Tool returns error"} | {e.g., Agent retries once, then proceeds without tool} |

### Contract Tests

> API consumer/provider verification. Mark `N/A` if this feature has no cross-service API contracts.

| ID | Contract | Consumer | Provider | Tool | Priority |
|----|----------|----------|----------|------|----------|
| CT-01 | {e.g., "Extraction service returns ContractExtraction schema"} | {e.g., Frontend} | {e.g., Backend extraction API} | {e.g., Schemathesis / Pact / manual schema validation} | P0 |
| CT-02 | {e.g., "SSE stream events match EventType enum"} | {e.g., Frontend EventSource handler} | {e.g., Backend streaming endpoint} | {e.g., Recorded session replay} | P1 |

### Fault Injection Tests

> How does the system behave when dependencies fail? Mark `N/A` if no external dependencies.

| ID | Scenario | Failure Injected | Expected Behavior | Priority |
|----|----------|-----------------|-------------------|----------|
| FI-01 | {e.g., "Anthropic API returns 500"} | {e.g., Mock returns 500 for all requests} | {e.g., Agent retries 2x, then returns error to user with "AI unavailable" message} | P0 |
| FI-02 | {e.g., "Redis connection drops mid-request"} | {e.g., Kill Redis container during test} | {e.g., Service continues in degraded mode; cache misses go to DB} | P1 |
| FI-03 | {e.g., "Qdrant latency spike (>5s)"} | {e.g., Proxy with artificial delay} | {e.g., Search times out after 3s, returns empty results with warning} | P1 |
| FI-04 | {e.g., "Database returns connection refused"} | {e.g., Stop PostgreSQL container} | {e.g., Health check returns 503; all API requests return 503} | P0 |

## 7. Test Data

### Datasets

| Dataset | Source | Size | Location |
|---------|--------|------|----------|
| {e.g., Sample contracts} | {e.g., Synthetic / anonymized real} | {e.g., 10 documents} | {e.g., tests/fixtures/contracts/} |
| {e.g., Ground truth labels} | {e.g., Manual annotation} | {e.g., 50 labeled extractions} | {e.g., eval/ground_truth/} |

### Test Data Lifecycle

| Aspect | Policy |
|--------|--------|
| Generation method | {e.g., Synthetic via `scripts/generate_fixtures.py` / Anonymized from production sample} |
| Version controlled? | {Yes — committed in `tests/fixtures/` / No — generated at test time} |
| Refresh cadence | {e.g., Regenerated when schema changes / Quarterly review for staleness} |
| Owner | {e.g., QA team / Feature owner} |
| PII / sensitive data | {e.g., "All fixtures are synthetic — no real PII"} |

## 8. AI / Model Testing

> Mark `N/A` if this feature does not involve AI/ML components.

### Eval Harness

| Aspect | Detail |
|--------|--------|
| Framework | {e.g., Custom eval runner at `eval/run_eval.py` / promptfoo / custom} |
| Ground truth dataset | {e.g., `eval/ground_truth/clause_extraction.jsonl` — 200 labeled examples} |
| Run command | {e.g., `python eval/run_eval.py --suite clause_extraction`} |

### Accuracy Metrics

| Metric | Baseline | Threshold | Action if Below |
|--------|----------|-----------|-----------------|
| {e.g., F1 (clause extraction)} | {e.g., 0.93} | {e.g., >= 0.90} | {e.g., Block merge, investigate prompt regression} |
| {e.g., Precision (entity extraction)} | {e.g., 0.96} | {e.g., >= 0.93} | {e.g., Review false positives} |
| {e.g., Recall (risk flag detection)} | {e.g., 0.91} | {e.g., >= 0.88} | {e.g., Review missed flags against ground truth} |

### Cost Tracking

| Test Run Type | Est. API Cost | Budget Cap |
|---------------|---------------|------------|
| {e.g., Full eval suite (200 docs)} | {e.g., $24} | {e.g., $50 per run} |
| {e.g., Smoke test (10 docs)} | {e.g., $1.20} | {e.g., $5 per run} |

## 9. Test Execution Priority

> When CI time is constrained, which tests run first? This ordering is used when running a subset of tests (e.g., `pytest -m "priority_p0"`).

| Priority | Tests Included | Max CI Time | When to Run |
|----------|---------------|-------------|-------------|
| P0 | {e.g., All unit tests + critical path integration tests} | {e.g., 5 min} | Every PR, every push |
| P1 | {e.g., Full integration suite + regression tests} | {e.g., 15 min} | Every PR |
| P2 | {e.g., Edge cases + fault injection + contract tests} | {e.g., 30 min} | Nightly + pre-release |
| P3 | {e.g., Full AI eval harness + load tests} | {e.g., 60 min} | Nightly only |

**If CI exceeds time budget**: Run P0 only on PR; defer P1+ to post-merge nightly. Never skip P0 tests.

## 10. Flaky Test Policy

| Aspect | Policy |
|--------|--------|
| Definition | A test that fails non-deterministically on the same code. Two unexplained failures in 7 days = flaky. |
| Quarantine process | Move to `tests/quarantine/` directory, excluded from merge-blocking CI. File tracking issue. |
| Retry policy | CI retries failed tests once. If the retry passes, the test is flagged as potentially flaky. |
| Fix ownership | The team that owns the feature owns the flaky test. Must be fixed or removed within 2 weeks. |
| Monitoring | {e.g., Weekly flaky test report from CI dashboard} |

## 11. Pass / Fail Criteria

| Criteria | Threshold |
|----------|-----------|
| All P0 tests pass | Required for merge |
| All P1 tests pass | Required for merge |
| Coverage meets target | Required for merge |
| No regression in {metric} | {e.g., recall@10 >= 0.85} |
| Performance within budget | {e.g., p95 < 5s — see [Perf Spec](../phase-{X}/{X.X}_perf-spec_{name}.md)} |

## 12. Known Limitations

- {e.g., "Anthropic API mocks don't test real model behavior — eval harness covers this separately"}
- {e.g., "VLM tests use synthetic images, not real scanned contracts"}

## 13. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Perf Spec | [Perf Spec](../phase-{X}/{X.X}_perf-spec_{name}.md) |
| ID Spec | [ID Spec](../phase-{X}/{X.X}_id-spec_{name}.md) |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial draft | {name} |
| {YYYY-MM-DD} | {e.g., Added AI eval metrics after pilot} | {name} |
| {YYYY-MM-DD} | {e.g., Approved} | {name} |
