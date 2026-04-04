# Legal AI Platform — Document Matrix

**Created**: 2026-03-31
**Purpose**: Map every roadmap item to required documentation artifacts.

---

## Document Type Legend

| Abbrev | Document | Purpose | When Written |
|--------|----------|---------|--------------|
| **BRD** | Business Requirements Document | Business justification, stakeholder impact, success metrics | Before phase begins |
| **PRD** | Product Requirements Document | User-facing requirements, acceptance criteria, UX implications | Before phase begins |
| **ADR** | Architecture Decision Record | Choice between alternatives, trade-offs, rationale | Before implementation of the decision |
| **Tech Spec** | Technical Specification | Detailed design, data flow, sequence diagrams, component interactions | Before implementation |
| **Test Spec** | Test Specification | Test strategy, test cases, coverage targets, environments | Before or alongside implementation |
| **ID Spec** | Interface Design Specification | API contracts, request/response schemas, protocols, data models | Before implementation |
| **Mig Guide** | Migration Guide | Data migration steps, schema changes, rollback procedures, downtime estimate | Before deployment |
| **Runbook** | Operational Runbook | Deployment steps, monitoring, alerting, incident response | Before production deployment |
| **Sec Review** | Security Review | Threat model, attack surface changes, compliance impact | Before merge of security-sensitive PRs |
| **Dep Review** | Dependency Review | License audit, CVE check, breaking change assessment | Before dependency upgrades |
| **Perf Spec** | Performance Specification | Benchmarks, baselines, regression thresholds, load profile | Before performance-sensitive changes |

---

## Classification Rules

- **S (Small) PRs**: Config changes, version bumps, single-file edits → minimal docs (often just PR description)
- **M (Medium) PRs**: New abstractions, service changes, multi-file → Tech Spec + Test Spec minimum
- **Phase-level**: Each phase gets a BRD (justifying the work) and a phase-level Test Spec
- **ADR**: Only where choices between alternatives exist — not every PR needs one
- **Sec Review**: Required for auth, crypto, data access, tenant isolation, new dependencies
- **ID Spec**: Required for any new/changed API endpoint, schema, or inter-service contract

---

## Phase 0: Stabilization

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | Yes | Justify stabilization sprint: risk of building on broken foundation, CI cost savings |
| **PRD** | No | No user-facing changes |
| **ADR** | No | No architectural decisions |
| **Tech Spec** | No | Fixing existing code, not designing new |
| **Test Spec** | Yes | Phase-level: define "green" baseline — what pass rate / coverage constitutes Phase 0 done |
| **Perf Spec** | Yes | Define baseline metrics to record (build time, bundle size, test time) |

### 0.1 — Fix Failing Tests

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `0.1.1` Fix WorkflowDesigner tests | **Test Spec** | Document which tests are failing and why, root cause for each |
| `0.1.2` Fix AdminDashboard tests | **Test Spec** | Same as above |
| `0.1.3` Audit `_green` test variants | **Test Spec** | Decision log: which tests kept, which deleted, why |
| `0.1.4` Fix backend pytest suite | **Test Spec** | Catalog of skipped tests with `reason=` justifications |
| `0.1.5` Fix frontend vitest suite | **Test Spec** | Same as above |

### 0.2 — Dependency Audit & Security Scan

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `0.2.1` Add pyproject.toml | **Tech Spec** | Brief: project metadata structure, build backend choice (hatchling/setuptools) |
| `0.2.2` pip-audit / npm audit | **Sec Review**, **Dep Review** | CVE report with severity, affected packages, remediation plan |
| `0.2.3` Pin transitive deps | **Dep Review** | Lock file strategy, update cadence policy |
| `0.2.4` Add package-lock.json | — | PR description sufficient |

### 0.3 — CI & Baseline Metrics

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `0.3.1` CI: backend pytest | **Tech Spec** | CI pipeline design: triggers, caching, artifact storage |
| `0.3.2` CI: frontend vitest | **Tech Spec** | Same pipeline doc, frontend section |
| `0.3.3` CI: ruff + black + mypy | **Tech Spec** | Linter config decisions (rule sets, strictness levels) |
| `0.3.4` CI: eslint + tsc | **Tech Spec** | Same as above, frontend section |
| `0.3.5` Record baseline metrics | **Perf Spec** | Define exact metrics, how measured, where stored, regression thresholds |

---

## Phase 1: Infrastructure Upgrades

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | Yes | Justify infra upgrades: EOL risk for PG 15, license risk for Redis, feature gaps in Qdrant 1.7 |
| **PRD** | No | No user-facing changes |
| **Tech Spec** | Yes | Phase-level: target versions, compatibility matrix, rollback strategy |
| **Test Spec** | Yes | Integration test strategy across all upgraded services |
| **Mig Guide** | Yes | Phase-level: data migration plan for PG upgrade, Qdrant re-index |
| **Runbook** | Yes | Deployment order, health check verification, rollback triggers |

### 1.1 — PostgreSQL 15 → 17

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `1.1.1` Update docker-compose images | **Mig Guide** | PG 17 breaking changes, data directory compat, upgrade path (pg_upgrade vs dump/restore) |
| `1.1.2` Test Alembic migrations on PG 17 | **Test Spec** | Migration test procedure: clean DB → run all 8 migrations → verify schema |
| `1.1.3` Enable pg_stat_statements | **Tech Spec**, **Runbook** | Extension config, query log retention, dashboard setup |
| `1.1.4` Update CI to PG 17 | — | PR description sufficient |

### 1.2 — Add pgvector Extension

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `1.2.1` Alembic migration: vector extension + table | **Tech Spec**, **Mig Guide** | Schema design: column type, index type (IVFFlat vs HNSW), dimension choice |
| `1.2.2` Add pgvector package | **Dep Review** | License, version compat with PG 17 |
| `1.2.3` SQLAlchemy DocumentEmbedding model | **Tech Spec**, **ID Spec** | Model fields, relationships, constraints |
| `1.2.4` PgVectorRepository | **Tech Spec**, **ID Spec**, **Test Spec** | Repository interface, query patterns, distance metric |
| `1.2.5` Integration test | **Test Spec** | Test data, expected results, performance baseline |

### 1.3 — Redis → Valkey (or Redis 8)

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `1.3.1` ADR: Valkey vs Redis 8 | **ADR** | License (SSPL vs BSD), feature parity, community health, migration effort |
| `1.3.2` Swap docker-compose image | **Mig Guide**, **Runbook** | Data persistence compat, config translation, health check changes |
| `1.3.3` Integration tests | **Test Spec** | Session, cache, pub/sub, Celery broker compatibility |

### 1.4 — Qdrant Upgrade (1.7 → 1.12+)

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `1.4.1` Bump qdrant-client | **Dep Review** | Breaking API changes between 1.7 and 1.12 |
| `1.4.2` Update docker-compose image | **Mig Guide** | Collection format compat, snapshot/restore procedure |
| `1.4.3` Refactor vector_store.py: named vectors | **Tech Spec**, **ID Spec** | Named vector schema design, backward compat with existing collections |
| `1.4.4` Add sparse vector support | **Tech Spec** | Sparse vector format, storage implications |
| `1.4.5` Integration test | **Test Spec** | CRUD operations, search accuracy validation |

### 1.5 — Neo4j Latest Patch

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `1.5.1` Update docker-compose | **Dep Review** | Changelog review, breaking changes |
| `1.5.2` Verify APOC + GDS compat | **Test Spec** | Plugin version matrix, procedure availability check |

---

## Phase 2: Backend Modernization

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | Yes | Justify: unmaintained deps (python-jose), API surface gaps, observability debt |
| **PRD** | No | No user-facing changes (API cleanup improves developer experience, not end-user) |
| **Tech Spec** | Yes | Phase-level: target framework versions, DI pattern, observability architecture |
| **Test Spec** | Yes | Regression testing strategy for framework upgrades |
| **Sec Review** | Yes | Phase-level: JWT library swap (jose → PyJWT), new middleware security posture |

### 2.1 — Python Dependency Upgrades

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `2.1.1` FastAPI + uvicorn bump | **Dep Review**, **Tech Spec** | Breaking changes in 0.110-0.115 (Pydantic v2 defaults, middleware changes) |
| `2.1.2` Pydantic bump | **Dep Review**, **Tech Spec** | V2 serialization changes, model_config vs Config class |
| `2.1.3` SQLAlchemy + Alembic bump | **Dep Review** | Async engine changes, migration runner changes |
| `2.1.4` httpx bump + jose → PyJWT | **Dep Review**, **Sec Review**, **Tech Spec** | JWT library swap: algorithm support, token format compat, key handling differences |
| `2.1.5` ruff replaces black | **ADR**, **Tech Spec** | Rule set selection, formatter config, pre-commit hook update |
| `2.1.6` Fix breakage | **Test Spec** | Regression test report |

### 2.2 — API Layer Cleanup

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `2.2.1` Remove try/except guards | **Tech Spec** | Startup failure behavior change — document new error handling |
| `2.2.2` Delete orphan endpoint | — | PR description sufficient |
| `2.2.3` Add missing endpoints | **ID Spec**, **Tech Spec**, **Test Spec** | New endpoint contracts: paths, methods, request/response schemas, auth requirements |
| `2.2.4` OpenAPI metadata | **ID Spec** | Tag taxonomy, description standards, response model documentation |
| `2.2.5` API versioning header | **Tech Spec**, **ID Spec** | Versioning strategy (header vs URL), deprecation policy |

### 2.3 — Structured Dependency Injection

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `2.3.1` Audit deps.py | **Tech Spec** | Current DI pattern → target pattern, gap analysis |
| `2.3.2` Typed providers | **Tech Spec**, **ID Spec** | Provider interfaces, lifecycle (request-scoped vs app-scoped) |
| `2.3.3` Annotated type aliases | **Tech Spec** | Convention doc: naming, import location, usage pattern |

### 2.4 — Replace Celery

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `2.4.1` ADR: Temporal vs Dramatiq | **ADR** | Feature comparison, operational complexity, community, cost, learning curve |
| `2.4.2` Add to docker-compose | **Tech Spec**, **Runbook** | Service config, resource requirements, health monitoring |
| `2.4.3` TaskRunner abstraction | **Tech Spec**, **ID Spec**, **Test Spec** | Interface design, dispatch patterns, retry semantics, error handling |
| `2.4.4` Migrate doc processing tasks | **Tech Spec**, **Mig Guide**, **Test Spec** | Task-by-task migration plan, dual-run period, validation |
| `2.4.5` Migrate remaining tasks | **Tech Spec**, **Mig Guide**, **Test Spec** | Same as above for notification + analytics tasks |
| `2.4.6` Remove Celery + Flower | **Mig Guide** | Cleanup checklist, config removal, monitoring gap fill |
| `2.4.7` Integration tests | **Test Spec** | End-to-end task flow tests, failure/retry scenarios |

### 2.5 — Observability & Error Handling

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `2.5.1` structlog | **Tech Spec** | Log schema (JSON fields), log levels per component, PII scrubbing rules |
| `2.5.2` OpenTelemetry | **Tech Spec**, **Runbook** | Trace propagation, span naming conventions, sampling rate, exporter config |
| `2.5.3` Prometheus /metrics | **Tech Spec**, **ID Spec**, **Runbook** | Metric names, labels, histogram buckets, scrape config, dashboard templates |
| `2.5.4` Sentry | **Tech Spec**, **Sec Review** | DSN config, PII filtering, environment tagging, alert rules |

---

## Phase 3: AI/ML Stack — Claude Agent SDK

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | Yes | Business case: why agentic architecture, ROI of Claude Agent SDK vs hand-rolled, accuracy improvement targets |
| **PRD** | Yes | User-facing impact: faster extraction, new agent-powered features, streaming responses |
| **ADR** | Yes | (Already decided) Claude Agent SDK as core — formalize the rationale document |
| **Tech Spec** | Yes | Phase-level: agent architecture, tool taxonomy, state management, cost controls |
| **Test Spec** | Yes | Agent testing strategy: unit (mock tools), integration (real services), eval (accuracy) |
| **ID Spec** | Yes | Agent invoke/stream API contracts, Pydantic output schemas |
| **Sec Review** | Yes | Prompt injection defense, tenant data isolation in agent context, API key management, cost abuse prevention |
| **Perf Spec** | Yes | Latency budgets per agent type, token cost targets per operation, throughput requirements |

### 3.1 — Claude Agent SDK Foundation

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.1.1` Add SDK deps | **Dep Review**, **Sec Review** | SDK license, network calls, data sent to Anthropic API |
| `3.1.2` base.py: agent config | **Tech Spec** | Base agent class design, config hierarchy, tenant context injection |
| `3.1.3` tools/ package + @tool wrapper | **Tech Spec**, **ID Spec**, **Sec Review** | Tool interface contract, tenant isolation enforcement, audit log schema |
| `3.1.4` state.py: persistence | **Tech Spec**, **ID Spec** | State schema, Redis key structure, TTL policy, serialization format |
| `3.1.5` Config env vars | **Tech Spec**, **Sec Review** | Secret management, cost limit enforcement mechanism |
| `3.1.6` POST /agents/invoke | **ID Spec**, **Tech Spec**, **Test Spec**, **Sec Review** | Request/response contract, auth requirements, rate limiting, input validation |
| `3.1.7` WS /agents/stream | **ID Spec**, **Tech Spec**, **Test Spec** | WebSocket protocol, message format, heartbeat, reconnection, backpressure |
| `3.1.8` Tests | **Test Spec** | Test strategy: mock Anthropic API, verify tool dispatch, state round-trip |

### 3.2 — Agent Tool Library

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.2.1` search_contracts tool | **ID Spec**, **Test Spec** | Tool input/output schema, search parameters, result format |
| `3.2.2` query_graph tool | **ID Spec**, **Test Spec**, **Sec Review** | Cypher injection prevention, query allowlist vs freeform |
| `3.2.3` get_embeddings tool | **ID Spec**, **Test Spec** | Input limits, provider selection, caching strategy |
| `3.2.4` extract_entities tool | **ID Spec**, **Test Spec** | Entity types, confidence thresholds, output schema |
| `3.2.5` score_risk tool | **ID Spec**, **Test Spec** | Risk dimensions, scoring range, model version |
| `3.2.6` get_similar_clauses tool | **ID Spec**, **Test Spec** | Similarity threshold, result ranking, deduplication |
| `3.2.7` get_contract_history tool | **ID Spec**, **Test Spec**, **Sec Review** | Tenant-scoped access, audit log fields |
| `3.2.8` store_extraction_result tool | **ID Spec**, **Test Spec**, **Sec Review** | Write permissions, validation, idempotency |
| `3.2.9` Integration test | **Test Spec** | End-to-end tool round-trip test plan |

### 3.3 — Specialized Agents

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.3.1` ExtractionAgent | **Tech Spec**, **ID Spec**, **Test Spec**, **Perf Spec** | System prompt design, tool selection logic, output schema, latency target |
| `3.3.2` AnalysisAgent | **Tech Spec**, **ID Spec**, **Test Spec**, **Perf Spec** | Same pattern |
| `3.3.3` ComplianceAgent | **Tech Spec**, **ID Spec**, **Test Spec**, **Sec Review** | Regulatory accuracy requirements, jurisdiction handling |
| `3.3.4` NegotiationAgent | **Tech Spec**, **ID Spec**, **Test Spec**, **PRD** | User-facing negotiation flow, guardrails on proposals |
| `3.3.5` ReviewAgent | **Tech Spec**, **ID Spec**, **Test Spec** | Redline format, diff algorithm, approval workflow |
| `3.3.6` Pydantic output schemas | **ID Spec** | Schema definitions, versioning strategy, backward compat |
| `3.3.7` AgentOrchestrator | **Tech Spec**, **ID Spec**, **Test Spec**, **Perf Spec** | Routing logic, chaining protocol, error propagation, cost aggregation |
| `3.3.8` Agent tests | **Test Spec**, **Perf Spec** | Sample contract corpus, expected outputs, accuracy thresholds, latency bounds |

### 3.4 — LangChain Slim-Down

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.4.1` Replace langchain package | **Dep Review**, **Tech Spec** | Identify all current LangChain imports, map to core-only replacements |
| `3.4.2` Remove Chain/Agent/LLM wrappers | **Tech Spec** | Migration mapping: old pattern → new Agent SDK pattern |
| `3.4.3` Keep retrieval utilities only | **Tech Spec** | Retained API surface, justification for each kept module |
| `3.4.4` Test RAG retrieval | **Test Spec** | Before/after retrieval comparison, regression check |

### 3.5 — Gemini 2.0 Embeddings

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.5.1` Add google-generativeai SDK | **Dep Review**, **Sec Review** | License, data residency, API key management |
| `3.5.2` GeminiEmbeddingProvider | **Tech Spec**, **ID Spec**, **Test Spec** | Provider interface impl, model selection, rate limiting |
| `3.5.3` Configurable dimensions | **Tech Spec** | Dimension trade-offs (cost vs accuracy), storage impact calculation |
| `3.5.4` Smart chunking | **Tech Spec**, **Test Spec** | Clause boundary detection algorithm, edge cases (nested clauses, definitions) |
| `3.5.5` Re-indexing script | **Tech Spec**, **Mig Guide**, **Runbook** | Batch size, progress tracking, resume-on-failure, estimated duration, rollback |
| `3.5.6` Matryoshka two-stage retrieval | **Tech Spec**, **Perf Spec** | Two-stage architecture, latency budget per stage, accuracy vs speed trade-off |
| `3.5.7` A/B comparison harness | **Test Spec**, **Perf Spec** | Eval methodology, query set, metrics (recall@k, MRR, latency, cost) |
| `3.5.8` Config env var | — | PR description sufficient |

### 3.6 — Hybrid Search

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.6.1` BM25 sparse vectors | **Tech Spec**, **Test Spec** | Tokenizer choice, legal vocabulary handling, stop words |
| `3.6.2` Dual named vectors in Qdrant | **Tech Spec**, **Mig Guide** | Schema migration for existing collections, re-index plan |
| `3.6.3` Reciprocal rank fusion | **Tech Spec** | RRF formula, k parameter, tie-breaking |
| `3.6.4` Update search service | **Tech Spec**, **ID Spec**, **Test Spec** | New search parameters, response format changes, backward compat |
| `3.6.5` Benchmark | **Perf Spec**, **Test Spec** | Query set, metrics, baseline comparison, statistical significance |

### 3.7 — VLM Document Pipeline

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.7.1` VLMTool base | **Tech Spec**, **ID Spec**, **Sec Review** | Image handling, data sent to API, PII in images, resolution/compression |
| `3.7.2` classify_document tool | **Tech Spec**, **ID Spec**, **Test Spec** | Classification taxonomy, confidence threshold, fallback behavior |
| `3.7.3` extract_table tool | **Tech Spec**, **ID Spec**, **Test Spec** | Table detection, cell extraction, header inference, output format |
| `3.7.4` detect_signatures tool | **Tech Spec**, **ID Spec**, **Test Spec**, **Sec Review** | Signature types, biometric data handling, false positive tolerance |
| `3.7.5` extract_from_scan tool | **Tech Spec**, **ID Spec**, **Test Spec**, **Perf Spec** | Schema-driven extraction, accuracy targets, cost per page |
| `3.7.6` Gemini Flash VLM backend | **Tech Spec**, **Dep Review**, **Sec Review** | Provider comparison, data residency, cost model |
| `3.7.7` Refactor document_ingestion | **Tech Spec**, **Mig Guide**, **Test Spec** | Decision tree: which pipeline for which doc type, dual-run validation |
| `3.7.8` Config env vars | — | PR description sufficient |
| `3.7.9` Integration test | **Test Spec**, **Perf Spec** | 10-contract test corpus, accuracy metrics, baseline comparison |

### 3.8 — ML Dependency Upgrades

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.8.1` torch + transformers bump | **Dep Review** | Breaking changes, CUDA/MPS compat, model loading changes |
| `3.8.2` sentence-transformers bump | **Dep Review** | API changes in 3.x, model compat |
| `3.8.3` openai SDK bump | **Dep Review** | Client API changes, deprecated methods |
| `3.8.4` spacy bump | **Dep Review** | Model compat, pipeline changes |
| `3.8.5` Fix breakage | **Test Spec** | Regression test report |

### 3.9 — Legacy AI Module Migration

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `3.9.1` Audit app/ai/ | **Tech Spec**, **ADR** | Classification matrix: each module → prompt / tool / deprecated. Rationale for each |
| `3.9.2` Extract financial_services | **Tech Spec**, **Test Spec** | Domain logic inventory, tool interface design, accuracy preservation |
| `3.9.3` Extract healthcare | **Tech Spec**, **Test Spec** | Same pattern, plus compliance-specific extraction rules |
| `3.9.4` Extract negotiation | **Tech Spec**, **Test Spec**, **PRD** | User-facing negotiation behavior changes, guardrail preservation |
| `3.9.5` HRM → system prompts | **Tech Spec**, **Test Spec**, **Perf Spec** | Reasoning quality comparison: coded HRM vs prompt-based, benchmark |
| `3.9.6` Deprecation plan | **Mig Guide** | Timeline, warning mechanism, removal target date |

---

## Phase 4: Frontend Modernization

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | No | Infra-only — no business case beyond maintainability |
| **PRD** | No | No user-facing behavior changes (visual regression check covers this) |
| **Tech Spec** | Yes | Phase-level: target versions, migration strategy, breaking change inventory |
| **Test Spec** | Yes | Visual regression strategy, component test migration plan |
| **Perf Spec** | Yes | Bundle size targets, build time targets, LCP/FCP budgets |

### 4.1 — Build Toolchain Upgrades

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.1.1` Vite 5 → 6 | **Dep Review**, **Tech Spec** | Breaking config changes, plugin compat |
| `4.1.2` TypeScript 5.3 → 5.7 | **Dep Review**, **Tech Spec** | New strict checks enabled, expected error count |
| `4.1.3` ESLint 8 → 9 flat config | **Tech Spec** | Config migration mapping, rule set changes |
| `4.1.4` typescript-eslint bump | **Dep Review** | Rule changes, new rules to enable |
| `4.1.5` Fix type + lint errors | **Test Spec** | Error inventory, fix strategy per category |

### 4.2 — React 18 → 19

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.2.1` Bump react + react-dom | **Dep Review**, **Tech Spec** | Breaking changes inventory, Radix UI compat, react-dnd compat |
| `4.2.2` Remove forwardRef | **Tech Spec** | Component inventory using forwardRef, migration pattern |
| `4.2.3` useContext → use() | **Tech Spec** | Which contexts benefit, Suspense integration |
| `4.2.4` Update testing-library | **Dep Review** | Act() changes, async util changes |
| `4.2.5` Fix test breakage | **Test Spec** | Regression report |

### 4.3 — Tailwind v3 → v4

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.3.1` Install v4 + codemods | **Tech Spec**, **Dep Review** | Codemod coverage, manual fixes needed |
| `4.3.2` CSS-based config | **Tech Spec** | Theme token mapping: JS config → CSS custom properties |
| `4.3.3` Remove postcss + autoprefixer | — | PR description sufficient |
| `4.3.4` Visual regression | **Test Spec** | Pages to screenshot, diff threshold, approval process |

### 4.4 — Routing Upgrade

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.4.1` ADR: TanStack vs react-router v7 | **ADR** | Type safety, bundle size, migration effort, search params, SSR readiness |
| `4.4.2` Install router + route tree | **Tech Spec**, **ID Spec** | Route hierarchy, type-safe params, loader/action patterns |
| `4.4.3` Migrate auth routes | **Test Spec** | Auth flow preservation, redirect behavior |
| `4.4.4` Migrate contract routes | **Test Spec** | URL compat, deep link preservation |
| `4.4.5` Migrate admin routes | **Test Spec** | Same as above |
| `4.4.6` Migrate workflow routes | **Test Spec** | Same as above |
| `4.4.7` Migrate remaining routes | **Test Spec** | Same as above |
| `4.4.8` Remove react-router-dom | — | Cleanup PR, description sufficient |

### 4.5 — Component Library Refresh

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.5.1` shadcn/ui init | **Tech Spec** | Theme config, component directory structure, import conventions |
| `4.5.2` Replace Button/Input/Card | **Tech Spec**, **Test Spec** | API compatibility mapping, prop name changes, visual diff |
| `4.5.3` Replace Dialog/Dropdown/Select | **Tech Spec**, **Test Spec** | Behavioral compat (focus trapping, keyboard nav), accessibility audit |
| `4.5.4` Replace Table → DataTable | **Tech Spec**, **Test Spec**, **ID Spec** | Column definition API, sorting/filtering/pagination interface |
| `4.5.5` Update lucide-react | **Dep Review** | Icon name changes, removed icons |

### 4.6 — State & Data Layer

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `4.6.1` react-query + zustand bump | **Dep Review** | Breaking changes in zustand v5 (no more currying) |
| `4.6.2` queryOptions pattern | **Tech Spec** | Convention doc: query key factory, type-safe queries, cache invalidation |
| `4.6.3` zod + react-hook-form bump | **Dep Review** | Schema compat, resolver changes |

---

## Phase 5: Data Integration & Legal Knowledge

### Phase-Level Documents

| Document | Required | Notes |
|----------|----------|-------|
| **BRD** | Yes | Business value of legal knowledge layer: accuracy improvement, competitive moat, pricing justification |
| **PRD** | Yes | User-facing features: clause benchmarking, legal context in risk reports, source attribution |
| **ADR** | Yes | Data source selection, licensing implications, data refresh strategy |
| **Tech Spec** | Yes | Ingestion architecture, graph schema, multi-collection RAG design |
| **Test Spec** | Yes | Eval methodology, ground-truth datasets, accuracy thresholds |
| **ID Spec** | Yes | New API endpoints, response schemas with source attribution |
| **Sec Review** | Yes | Open data licensing, data mixing rules (tenant data + public corpus), PII in case law |
| **Perf Spec** | Yes | Ingestion throughput, query latency with multi-collection retrieval |

### 5.1 — Open Legal Data Ingestion

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `5.1.1` ADR: data sources | **ADR**, **Sec Review** | Source evaluation: Caselaw Access Project, CourtListener, open regulatory. License terms, data quality, API limits |
| `5.1.2` LegalCorpusIngester | **Tech Spec**, **ID Spec**, **Test Spec** | Ingestion pipeline: fetch → normalize → chunk → embed → store. Rate limits, error handling |
| `5.1.3` Qdrant legal_corpus collection | **Tech Spec**, **ID Spec** | Collection schema, index config, tenant isolation (global read-only) |
| `5.1.4` Neo4j case_law subgraph | **Tech Spec**, **ID Spec** | Node types, relationship types, property schemas, Cypher query patterns |
| `5.1.5` Bulk load 10K cases | **Mig Guide**, **Runbook**, **Perf Spec** | Load procedure, duration estimate, validation queries, storage impact |
| `5.1.6` Incremental sync | **Tech Spec**, **Runbook** | Schedule, dedup strategy, conflict resolution, monitoring |

### 5.2 — Knowledge-Enriched RAG

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `5.2.1` Multi-collection retrieval | **Tech Spec**, **Perf Spec**, **Test Spec** | Parallel query design, result merging, latency budget |
| `5.2.2` Source attribution | **Tech Spec**, **ID Spec**, **PRD** | Attribution UI requirements, label schema, citation format |
| `5.2.3` Legal context injection | **Tech Spec**, **Test Spec** | Prompt design for injecting case law, context window management |
| `5.2.4` Risk scoring enrichment | **Tech Spec**, **Test Spec**, **PRD** | How litigation data changes risk scores, user-facing explanation |

### 5.3 — Clause Benchmarking

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `5.3.1` Extract clause patterns | **Tech Spec**, **Test Spec** | Clause taxonomy, pattern matching methodology, corpus coverage |
| `5.3.2` Clause similarity index | **Tech Spec**, **Perf Spec** | Index structure, similarity metric, update frequency |
| `5.3.3` Benchmark endpoint | **ID Spec**, **Test Spec**, **Sec Review** | Request/response schema, auth, rate limiting, tenant data exposure rules |
| `5.3.4` Frontend benchmark widget | **PRD**, **Tech Spec**, **Test Spec** | UI design, data visualization, interaction patterns |

### 5.4 — AI Evaluation Harness

| PR | Documents Required | Notes |
|----|-------------------|-------|
| `5.4.1` eval/ framework | **Tech Spec** | Framework design: dataset format, metric definitions, run configuration |
| `5.4.2` Ground-truth dataset | **Test Spec**, **Sec Review** | Data sourcing (synthetic vs real), annotation guidelines, PII handling |
| `5.4.3` Extraction accuracy eval | **Test Spec**, **Perf Spec** | Metrics: precision, recall, F1 per entity. Pass/fail thresholds |
| `5.4.4` RAG retrieval eval | **Test Spec**, **Perf Spec** | Metrics: recall@k, MRR, nDCG. Query set design |
| `5.4.5` VLM vs OCR comparison | **Test Spec**, **Perf Spec** | Side-by-side methodology, statistical significance, cost comparison |
| `5.4.6` CI eval integration | **Tech Spec**, **Runbook** | Trigger conditions, regression thresholds, alert routing |

---

## Document Count Summary

| Phase | BRD | PRD | ADR | Tech Spec | Test Spec | ID Spec | Mig Guide | Runbook | Sec Review | Dep Review | Perf Spec | Total Docs |
|-------|-----|-----|-----|-----------|-----------|---------|-----------|---------|------------|------------|-----------|------------|
| **Phase 0** | 1 | 0 | 0 | 4 | 7 | 0 | 0 | 0 | 1 | 2 | 2 | **17** |
| **Phase 1** | 1 | 0 | 1 | 6 | 6 | 3 | 4 | 2 | 0 | 3 | 0 | **26** |
| **Phase 2** | 1 | 0 | 2 | 14 | 9 | 6 | 3 | 3 | 3 | 1 | 0 | **42** |
| **Phase 3** | 1 | 2 | 2 | 27 | 27 | 22 | 4 | 2 | 11 | 6 | 12 | **116** |
| **Phase 4** | 0 | 0 | 1 | 10 | 10 | 2 | 0 | 0 | 0 | 8 | 1 | **32** |
| **Phase 5** | 1 | 3 | 1 | 12 | 11 | 6 | 2 | 3 | 3 | 0 | 5 | **47** |
| **Totals** | **5** | **5** | **7** | **73** | **70** | **39** | **13** | **10** | **18** | **20** | **20** | **280** |

---

## Document Templates Location

All templates should live in `docs/templates/`:

```
docs/templates/
├── BRD_TEMPLATE.md
├── PRD_TEMPLATE.md
├── ADR_TEMPLATE.md          # Follows Michael Nygard's format
├── TECH_SPEC_TEMPLATE.md
├── TEST_SPEC_TEMPLATE.md
├── ID_SPEC_TEMPLATE.md      # OpenAPI + Pydantic schemas
├── MIG_GUIDE_TEMPLATE.md
├── RUNBOOK_TEMPLATE.md
├── SEC_REVIEW_TEMPLATE.md
├── DEP_REVIEW_TEMPLATE.md
├── PERF_SPEC_TEMPLATE.md
└── README.md                # When to use which template
```

## Practical Guidance

### Not every doc needs to be heavyweight

- **S-size PRs** with just a Dep Review → a checklist in the PR description is fine
- **Tech Specs** for small tools (3.2.x) → can be a single markdown section, not a multi-page doc
- **Test Specs** for simple integration tests → test file docstring + coverage target is sufficient

### Bundle documents where it makes sense

- All 8 tools in 3.2 can share one **Tool Library ID Spec** instead of 8 separate docs
- All route migrations in 4.4.3–4.4.7 can share one **Routing Migration Test Spec**
- All dep bumps in 2.1.1–2.1.5 can share one **Phase 2.1 Dep Review**

### Document review gates

| Gate | Required Before |
|------|----------------|
| BRD approved by stakeholder | Phase kickoff |
| ADR approved by tech lead | Implementation of the decision |
| Tech Spec peer-reviewed | PR creation |
| Sec Review signed off | Merge of security-sensitive PR |
| Mig Guide tested in staging | Production deployment |
| Runbook validated via dry-run | Production deployment |

---

*This matrix is a living document. Adjust document requirements as scope becomes clearer.*
