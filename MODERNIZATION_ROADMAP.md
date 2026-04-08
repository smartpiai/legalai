# Legal AI Platform — Modernization Roadmap

**Created**: 2026-03-31
**Last Active**: ~7 months ago (Aug/Sep 2025)
**Goal**: Decompose all modernization work into small, reviewable PRs across 5 workstreams.

---

## High-Level Overview

```
          Phase 0              Phase 1             Phase 2            Phase 3           Phase 4
       STABILIZE           INFRASTRUCTURE       BACKEND MOD        AI/ML OVERHAUL     FRONTEND MOD
       (Week 1-2)           (Week 2-4)           (Week 3-6)         (Week 4-8)        (Week 6-9)
     ┌───────────┐       ┌──────────────┐     ┌─────────────┐    ┌──────────────┐   ┌─────────────┐
     │ Fix tests │       │ PG 17        │     │ FastAPI 0.115│    │ Multi-LLM    │   │ React 19    │
     │ Audit deps│──────▶│ Redis/Valkey │────▶│ Pydantic v2  │───▶│ Gemini embed │──▶│ Vite 6      │
     │ Green CI  │       │ pgvector     │     │ API cleanup  │    │ VLM pipeline │   │ Tailwind v4 │
     │ Baselines │       │ Qdrant 1.12  │     │ Temporal     │    │ Hybrid search│   │ TanStack    │
     └───────────┘       └──────────────┘     └─────────────┘    └──────────────┘   └─────────────┘
                                                                        │
                                                                        ▼
                                                                  Phase 5
                                                              DATA & INTEGRATION
                                                                (Week 8-12)
                                                             ┌──────────────┐
                                                             │ Legal corpus │
                                                             │ Knowledge    │
                                                             │   graph      │
                                                             │ Eval harness │
                                                             └──────────────┘
```

**Parallelism**: Phases 1-2 overlap. Phases 3-4 overlap. Phase 5 depends on Phase 3.

**PR sizing target**: Every PR should be ≤400 lines changed, single-purpose, independently mergeable.

---

## Phase 0: Stabilization (Prerequisite — Week 1-2)

> Everything else builds on a green CI and known-good baseline. Do this first.

### 0.1 — Fix Failing Tests
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `0.1.1` | Fix WorkflowDesignerPage tests (59% → 100%) | S | — |
| `0.1.2` | Fix AdminDashboardPage tests (83% → 100%) | S | — |
| `0.1.3` | Audit all `_green` test variants — delete stale, merge passing | S | — |
| `0.1.4` | Run full backend `pytest` suite, fix or skip broken tests with `@pytest.mark.skip(reason=...)` | M | — |
| `0.1.5` | Run full frontend `vitest` suite, fix or skip broken tests | M | — |

### 0.2 — Dependency Audit & Security Scan
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `0.2.1` | Add `pyproject.toml` with `[project]` metadata (replace bare requirements.txt as source of truth) | S | — |
| `0.2.2` | Run `pip-audit` / `npm audit`, document all CVEs | S | — |
| `0.2.3` | Pin all transitive deps with `pip-compile` (add `requirements.lock`) | S | 0.2.1 |
| `0.2.4` | Add `package-lock.json` to git if missing | S | — |

### 0.3 — CI & Baseline Metrics
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `0.3.1` | Gitea CI: backend pytest + coverage report on every PR | S | 0.1.4 |
| `0.3.2` | Gitea CI: frontend vitest + coverage report on every PR | S | 0.1.5 |
| `0.3.3` | Gitea CI: `ruff check` + `black --check` + `mypy` on backend | S | — |
| `0.3.4` | Gitea CI: `eslint` + `tsc --noEmit` on frontend | S | — |
| `0.3.5` | Record baseline metrics: test count, coverage %, build time, bundle size | S | 0.3.1, 0.3.2 |

---

## Phase 1: Infrastructure Upgrades (Week 2-4)

> Upgrade the data layer and runtime dependencies. Backend/frontend code stays unchanged.

### 1.1 — PostgreSQL 15 → 17
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `1.1.1` | Update `docker-compose.yml` + `docker-compose.dev.yml`: postgres image `15` → `17` | S | Phase 0 |
| `1.1.2` | Test all 8 Alembic migrations run cleanly against PG 17 | S | 1.1.1 |
| `1.1.3` | Enable `pg_stat_statements` extension in PG 17 for query profiling | S | 1.1.1 |
| `1.1.4` | Update CI to use PG 17 service container | S | 1.1.2 |

### 1.2 — Add pgvector Extension
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `1.2.1` | Add Alembic migration: `CREATE EXTENSION vector` + `document_embeddings` table with `vector(1536)` column | S | 1.1.2 |
| `1.2.2` | Add `pgvector` Python package to `pyproject.toml` | S | 1.2.1 |
| `1.2.3` | Add SQLAlchemy model for `DocumentEmbedding` with vector column type | S | 1.2.2 |
| `1.2.4` | Add repository layer: `PgVectorRepository` with `search_similar()` using `<=>` operator | M | 1.2.3 |
| `1.2.5` | Integration test: insert embeddings, query by cosine similarity | S | 1.2.4 |

### 1.3 — Redis → Valkey (or Redis 8)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `1.3.1` | Evaluate: Valkey vs Redis 8 — document decision in ADR | S | Phase 0 |
| `1.3.2` | Update docker-compose: swap image, verify health checks | S | 1.3.1 |
| `1.3.3` | Run integration tests against new cache backend | S | 1.3.2 |

### 1.4 — Qdrant Upgrade (1.7 → 1.12+)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `1.4.1` | Bump `qdrant-client` in `pyproject.toml` to `1.12.x` | S | Phase 0 |
| `1.4.2` | Update docker-compose: Qdrant image to latest stable | S | 1.4.1 |
| `1.4.3` | Refactor `vector_store.py`: use named vectors API (prep for multi-vector per doc) | M | 1.4.1 |
| `1.4.4` | Add sparse vector support to collection schema (prep for hybrid search) | S | 1.4.3 |
| `1.4.5` | Integration test: named vector CRUD + sparse vector search | S | 1.4.4 |

### 1.5 — Neo4j 5 → Latest Patch
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `1.5.1` | Update docker-compose Neo4j to latest 5.x patch | S | Phase 0 |
| `1.5.2` | Verify APOC + GDS plugin compatibility, update if needed | S | 1.5.1 |

---

## Phase 2: Backend Modernization (Week 3-6)

> Upgrade the Python stack, clean up the API surface, modernize async patterns.

### 2.1 — Python Dependency Upgrades (Non-AI)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `2.1.1` | Bump `fastapi` 0.109 → 0.115, `uvicorn` 0.27 → 0.34 | S | Phase 0 |
| `2.1.2` | Bump `pydantic` 2.5 → 2.10, `pydantic-settings` 2.1 → 2.7 | S | 2.1.1 |
| `2.1.3` | Bump `sqlalchemy` 2.0.25 → 2.0.36, `alembic` 1.13 → 1.14 | S | Phase 0 |
| `2.1.4` | Bump `httpx` 0.25 → 0.28, `python-jose` → `PyJWT` (jose is unmaintained) | S | Phase 0 |
| `2.1.5` | Bump dev tools: `ruff` 0.1 → 0.9 (replaces black + isort + flake8), remove `black` | S | Phase 0 |
| `2.1.6` | Run full test suite, fix any breakage from above bumps | M | 2.1.1–2.1.5 |

### 2.2 — API Layer Cleanup
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `2.2.1` | Remove `try/except ImportError` guards from `router.py` — all routes should load or fail loudly | S | 2.1.6 |
| `2.2.2` | Delete orphan `api/v1/endpoints/contracts.py` (duplicate of `api/v1/contracts.py`) | S | 2.2.1 |
| `2.2.3` | Audit each route file: add missing service endpoints for `analysis`, `integrations`, `reporting` | M | 2.2.1 |
| `2.2.4` | Add OpenAPI tags, descriptions, and response models to all endpoints | M | 2.2.3 |
| `2.2.5` | Add API versioning header (`X-API-Version`) via middleware | S | 2.2.1 |

### 2.3 — Structured Dependency Injection
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `2.3.1` | Audit `deps.py` — ensure all service instantiation goes through FastAPI `Depends()` | S | 2.2.1 |
| `2.3.2` | Add typed dependency providers for Neo4j, Qdrant, Redis (currently global singletons in `database.py`) | M | 2.3.1 |
| `2.3.3` | Add `Annotated` type aliases for common deps (e.g., `CurrentUser = Annotated[User, Depends(get_current_user)]`) | S | 2.3.2 |

### 2.4 — Replace Celery with Temporal (or Dramatiq)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `2.4.1` | Spike: evaluate Temporal vs Dramatiq for this project's task patterns — write ADR | S | Phase 0 |
| `2.4.2` | Add Temporal server to docker-compose (or Dramatiq + Redis broker) | S | 2.4.1 |
| `2.4.3` | Create `TaskRunner` abstraction that wraps task dispatch (allows swapping backends) | M | 2.4.2 |
| `2.4.4` | Migrate `document_processing_queue` tasks to new runner | M | 2.4.3 |
| `2.4.5` | Migrate remaining Celery tasks (notifications, analytics) | M | 2.4.4 |
| `2.4.6` | Remove Celery + Flower from deps and docker-compose | S | 2.4.5 |
| `2.4.7` | Integration tests for all migrated task workflows | M | 2.4.5 |

### 2.5 — Observability & Error Handling
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `2.5.1` | Add `structlog` for structured JSON logging (replace print/logging calls) | M | 2.1.6 |
| `2.5.2` | Add OpenTelemetry SDK: traces for API requests, spans for DB/AI calls | M | 2.5.1 |
| `2.5.3` | Add Prometheus metrics endpoint (`/metrics`) with request latency histograms | S | 2.5.2 |
| `2.5.4` | Add Sentry SDK for error tracking (configurable via env var) | S | 2.5.1 |

---

## Phase 3: AI/ML Stack Overhaul (Week 4-8)

> The highest-impact phase. Claude Agent SDK is the primary orchestration layer.
> Everything else (embeddings, VLM, search, graph) becomes a tool the agent calls.

### Architecture Decision: Claude Agent SDK as Core

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK (Orchestration)              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Extraction   │  │  Analysis    │  │  Negotiation          │ │
│  │  Agent        │  │  Agent       │  │  Agent                │ │
│  │              │  │              │  │                       │ │
│  │  Tools:      │  │  Tools:      │  │  Tools:               │ │
│  │  - VLM       │  │  - Qdrant    │  │  - clause_benchmark   │ │
│  │  - OCR       │  │  - Neo4j     │  │  - risk_score         │ │
│  │  - chunker   │  │  - pgvector  │  │  - market_standards   │ │
│  │  - classifier│  │  - BM25      │  │  - legal_corpus       │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Compliance   │  │  Review      │  │  Orchestrator         │ │
│  │  Agent        │  │  Agent       │  │  (coordinates agents) │ │
│  │              │  │              │  │                       │ │
│  │  Tools:      │  │  Tools:      │  │  Manages:             │ │
│  │  - reg_db    │  │  - diff      │  │  - agent routing      │ │
│  │  - case_law  │  │  - redline   │  │  - state persistence  │ │
│  │  - audit_log │  │  - approve   │  │  - cost tracking      │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                    │                      │
        ▼                    ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│  Gemini 2.0  │  │  Qdrant + Neo4j  │  │  PostgreSQL + Redis   │
│  Embeddings  │  │  (retrieval)     │  │  (state + cache)      │
└──────────────┘  └──────────────────┘  └───────────────────────┘
```

**Key principle**: Claude Agent SDK owns the reasoning loop. LangChain is demoted to a
utility library for chunking/retrieval primitives only — no chains, no graphs. Structured
outputs use the SDK's native Pydantic support (no Instructor needed).

### 3.1 — Claude Agent SDK Foundation
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.1.1` | Add `claude-agent-sdk` + `anthropic` SDK to `pyproject.toml` | S | Phase 0 |
| `3.1.2` | Create `backend/app/agents/base.py`: base agent config (model, system prompt, token budget, tenant context) | M | 3.1.1 |
| `3.1.3` | Create `backend/app/agents/tools/` package: `@tool` decorator wrapper that adds tenant isolation + audit logging to every tool call | M | 3.1.2 |
| `3.1.4` | Create `backend/app/agents/state.py`: agent state persistence to PostgreSQL (conversation history, intermediate results, cost tracking) with Redis as hot cache for active sessions | M | 3.1.2 |
| `3.1.5` | Config: `ANTHROPIC_API_KEY`, `AGENT_MODEL=claude-sonnet-4-6`, `AGENT_MAX_TOKENS`, `AGENT_COST_LIMIT_PER_REQUEST` env vars | S | 3.1.2 |
| `3.1.6` | Add `POST /api/v1/agents/invoke` generic endpoint: accepts agent_type + input + jurisdiction, returns structured result | M | 3.1.2 |
| `3.1.7` | Add WebSocket endpoint `WS /api/v1/agents/stream` for streaming agent responses to frontend | M | 3.1.6 |
| `3.1.8` | Create `backend/app/agents/jurisdiction.py`: `JurisdictionRegistry` that loads jurisdiction configs (YAML) and provides `JurisdictionContext` for agent prompt injection | M | 3.1.2 |
| `3.1.9` | Create `backend/app/agents/jurisdiction_configs/` with initial configs: `FR.yaml`, `EG.yaml`, `GB.yaml` — each defines legal_system, language, clause_rules, agent_context addendum, risk_framework | M | 3.1.8 |
| `3.1.10` | Jurisdiction-aware agent base: `base.py` accepts `JurisdictionContext`, injects jurisdiction-specific system prompt addendum + clause library + risk framework into every agent invocation | M | 3.1.8 |
| `3.1.11` | Tests: agent initialization, tool registration, state persistence, cost tracking, jurisdiction context injection | M | 3.1.4, 3.1.10 |

### 3.2 — Agent Tool Library (wrapping existing services)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.2.1` | Tool: `search_contracts(query, filters, jurisdiction)` — wraps existing `search.py` service, filters by jurisdiction when provided | S | 3.1.3 |
| `3.2.2` | Tool: `query_graph(cypher)` — wraps existing `graph_data.py` Neo4j queries | S | 3.1.3 |
| `3.2.3` | Tool: `get_embeddings(text)` — wraps existing `embedding.py` (provider-agnostic) | S | 3.1.3 |
| `3.2.4` | Tool: `extract_entities(text)` — wraps existing `extraction.py` spaCy/NER pipeline | S | 3.1.3 |
| `3.2.5` | Tool: `score_risk(clause_text, clause_type, jurisdiction)` — wraps risk assessment service, applies jurisdiction-specific risk framework | S | 3.1.3, 3.1.10 |
| `3.2.6` | Tool: `get_similar_clauses(clause_text, top_k, jurisdiction)` — wraps Qdrant similarity search, scoped to jurisdiction corpus | S | 3.1.3 |
| `3.2.7` | Tool: `get_contract_history(contract_id)` — wraps audit trail + version history | S | 3.1.3 |
| `3.2.8` | Tool: `store_extraction_result(contract_id, data)` — writes structured results to PostgreSQL | S | 3.1.3 |
| `3.2.9` | Tool: `get_jurisdiction_context(jurisdiction_code)` — returns clause rules, legal references, and risk indicators for a jurisdiction | S | 3.1.8 |
| `3.2.10` | Integration test: agent calls each tool, verifies round-trip through real services including jurisdiction-scoped queries | M | 3.2.1–3.2.9 |

### 3.3 — Specialized Agents
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.3.1` | `ExtractionAgent`: system prompt + tools for contract data extraction, outputs `ContractExtraction` Pydantic model. Accepts `JurisdictionContext` to adapt extraction to jurisdiction-specific clause structures | M | 3.2.1–3.2.10 |
| `3.3.2` | `AnalysisAgent`: system prompt + tools for risk analysis, clause review, outputs `ContractAnalysis` model. Uses jurisdiction risk framework for scoring | M | 3.2.1–3.2.10 |
| `3.3.3` | `ComplianceAgent`: system prompt + tools for regulatory checks, outputs `ComplianceReport` model. Loads jurisdiction-specific regulatory references (e.g., Code Civil, Egyptian Civil Code, English common law precedents) | M | 3.2.1–3.2.10 |
| `3.3.4` | `NegotiationAgent`: system prompt + tools for term comparison and counter-proposal generation. Benchmarks against jurisdiction-specific market standards | M | 3.2.1–3.2.10 |
| `3.3.5` | `ReviewAgent`: system prompt + tools for redline comparison, amendment analysis | M | 3.2.1–3.2.10 |
| `3.3.6` | Pydantic output schemas for each agent: `ContractExtraction`, `ContractAnalysis`, `ComplianceReport`, `NegotiationProposal`, `ReviewSummary` — all include `jurisdiction` and `legal_system` fields | M | 3.3.1 |
| `3.3.7` | `AgentOrchestrator`: routes incoming requests to the right agent, resolves jurisdiction from contract metadata, injects `JurisdictionContext`, chains agents for multi-step workflows | M | 3.3.1–3.3.5 |
| `3.3.8` | Tests: each agent with sample contracts across jurisdictions (FR civil law, EG mixed, GB common law), verify structured output adapts to jurisdiction, verify tool call sequences | M | 3.3.1–3.3.5 |

### 3.4 — LangChain Slim-Down (0.1 → core-only 0.3)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.4.1` | Replace `langchain==0.1.0` with `langchain-core==0.3.x` + `langchain-community` (no chains, no agents — retrieval utilities only) | S | 3.1.3 |
| `3.4.2` | Refactor: remove all LangChain `Chain` / `Agent` / `LLM` wrapper usage — these are now handled by Claude Agent SDK | M | 3.4.1 |
| `3.4.3` | Keep only: `langchain_core.documents`, `langchain_text_splitters`, `langchain_community.vectorstores` | S | 3.4.2 |
| `3.4.4` | Test: RAG retrieval still works with slimmed-down LangChain | S | 3.4.3 |

### 3.5 — Gemini 2.0 Embeddings
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.5.1` | Add `google-generativeai` SDK to deps | S | Phase 0 |
| `3.5.2` | Add `GeminiEmbeddingProvider` implementing existing `EmbeddingProvider` interface in `embedding.py` | M | 3.5.1 |
| `3.5.3` | Support configurable output dimensions (256 for filtering, 768 for search, 1024 for precision) | S | 3.5.2 |
| `3.5.4` | Smart chunking: chunk at clause/section boundaries instead of fixed token windows | M | 3.5.2 |
| `3.5.5` | Re-indexing script: backfill Qdrant collection with Gemini embeddings alongside existing Ada-002 | M | 3.5.4 |
| `3.5.6` | Add Matryoshka-style two-stage retrieval: fast filter (256-dim) → precision re-rank (1024-dim) | M | 3.5.3 |
| `3.5.7` | A/B comparison harness: query both embedding providers, compare recall@10 | M | 3.5.5 |
| `3.5.8` | Config: `EMBEDDING_PROVIDER=gemini|openai|sentence_transformers` env var | S | 3.5.2 |

### 3.6 — Hybrid Search (Dense + Sparse)
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.6.1` | Add BM25 sparse vector generation for legal text (using `fastembed` or custom tokenizer) | M | 1.4.4 |
| `3.6.2` | Update Qdrant collection schema: dual named vectors (`dense` + `sparse`) per document chunk | S | 3.6.1, 1.4.3 |
| `3.6.3` | Implement reciprocal rank fusion (RRF) for combining dense + sparse results | S | 3.6.2 |
| `3.6.4` | Update `search.py` service + `search_contracts` tool: hybrid search as default | M | 3.6.3 |
| `3.6.5` | Benchmark: hybrid vs dense-only on legal query test set | S | 3.6.4 |

### 3.7 — VLM Document Pipeline
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.7.1` | Create `backend/app/agents/tools/vlm.py`: `VLMTool` that converts PDF pages to images and calls Claude vision | M | 3.1.3 |
| `3.7.2` | Tool: `classify_document(page_image)` → document type (NDA/MSA/SOW/amendment/exhibit) | M | 3.7.1 |
| `3.7.3` | Tool: `extract_table(page_image)` → structured JSON table | M | 3.7.1 |
| `3.7.4` | Tool: `detect_signatures(page_image)` → signed/unsigned blocks, stamps, seals | M | 3.7.1 |
| `3.7.5` | Tool: `extract_from_scan(page_image, extraction_schema)` → Pydantic model (replaces OCR + NER pipeline) | M | 3.7.1 |
| `3.7.6` | Add Gemini 2.0 Flash as alternative VLM backend (fast/cheap for high-volume) | M | 3.7.1 |
| `3.7.7` | Refactor `document_ingestion.py`: route scanned docs through VLM tools, digital PDFs through text extraction | M | 3.7.5 |
| `3.7.8` | Config: `VLM_PROVIDER=claude|gemini`, `DOCUMENT_PIPELINE=vlm|ocr|hybrid` | S | 3.7.7 |
| `3.7.9` | Integration test: process 10 sample contracts (5 digital, 5 scanned), compare VLM vs OCR accuracy | M | 3.7.7 |

### 3.8 — ML Dependency Upgrades
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.8.1` | Bump `torch` 2.1 → 2.6, `transformers` 4.36 → 4.48 | S | Phase 0 |
| `3.8.2` | Bump `sentence-transformers` 2.2 → 3.x | S | 3.8.1 |
| `3.8.3` | Bump `openai` 1.6 → 1.60+ (still needed for Ada-002 embeddings during migration) | S | Phase 0 |
| `3.8.4` | Bump `spacy` 3.7 → 3.8, update model download | S | Phase 0 |
| `3.8.5` | Run AI test suite, fix any breakage | M | 3.8.1–3.8.4 |

### 3.9 — Legacy AI Module Migration
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `3.9.1` | Audit `backend/app/ai/` (11 files, ~300K lines) — identify which logic should become agent system prompts vs tools vs deprecated | M | 3.3.7 |
| `3.9.2` | Extract reusable domain logic from `financial_services_suite.py` into tools the FinancialAgent can call | M | 3.9.1 |
| `3.9.3` | Extract reusable domain logic from `healthcare_life_sciences.py` into tools the HealthcareAgent can call | M | 3.9.1 |
| `3.9.4` | Extract reusable domain logic from `negotiation_system.py` into NegotiationAgent tools + system prompt | M | 3.9.1 |
| `3.9.5` | Migrate `hrm_framework.py` reasoning patterns into agent system prompts (HRM becomes prompt engineering, not code) | M | 3.9.1 |
| `3.9.6` | Deprecation plan: mark legacy `app/ai/` modules as deprecated, add warnings | S | 3.9.2–3.9.5 |

---

## Phase 4: Frontend Modernization (Week 6-9)

> Upgrade the frontend toolchain and component library. Can run in parallel with Phase 3.

### 4.1 — Build Toolchain Upgrades
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.1.1` | Bump `vite` 5 → 6, update `vite.config.ts` for breaking changes | S | Phase 0 |
| `4.1.2` | Bump `typescript` 5.3 → 5.7, enable `noUncheckedIndexedAccess` | S | 4.1.1 |
| `4.1.3` | Migrate ESLint 8 → 9 flat config (`eslint.config.js`), remove `.eslintrc` | M | 4.1.1 |
| `4.1.4` | Bump `@typescript-eslint/*` 6.x → 8.x | S | 4.1.3 |
| `4.1.5` | Run `tsc --noEmit` + `eslint`, fix type errors and lint issues | M | 4.1.2, 4.1.4 |

### 4.2 — React 18 → 19
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.2.1` | Bump `react` + `react-dom` to 19.x, update `@types/react` | S | 4.1.5 |
| `4.2.2` | Remove `forwardRef` wrappers (ref is a regular prop in React 19) | M | 4.2.1 |
| `4.2.3` | Replace `useContext` patterns with `use()` hook where beneficial | M | 4.2.1 |
| `4.2.4` | Update `@testing-library/react` to React 19 compatible version | S | 4.2.1 |
| `4.2.5` | Run full test suite, fix React 19 specific breakage | M | 4.2.4 |

### 4.3 — Tailwind CSS v3 → v4
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.3.1` | Install Tailwind v4, run `@tailwindcss/upgrade` codemods | M | 4.1.1 |
| `4.3.2` | Migrate `tailwind.config.js` → CSS-based config (`@theme` directives) | M | 4.3.1 |
| `4.3.3` | Remove `postcss.config.js` + `autoprefixer` (built into Tailwind v4) | S | 4.3.2 |
| `4.3.4` | Visual regression check: compare key pages before/after | S | 4.3.3 |

### 4.4 — Routing Upgrade
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.4.1` | Evaluate: TanStack Router vs react-router v7 — write ADR | S | Phase 0 |
| `4.4.2` | Install chosen router, create parallel route tree | M | 4.4.1, 4.2.1 |
| `4.4.3` | Migrate auth routes (login, register, forgot-password, reset) | S | 4.4.2 |
| `4.4.4` | Migrate contract routes (list, create, details, edit) | M | 4.4.2 |
| `4.4.5` | Migrate admin routes (dashboard, users, tenants, roles, settings) | M | 4.4.2 |
| `4.4.6` | Migrate workflow routes (designer, tasks, list) | S | 4.4.2 |
| `4.4.7` | Migrate remaining routes (documents, templates, reports, profile) | M | 4.4.2 |
| `4.4.8` | Remove `react-router-dom`, delete old route config | S | 4.4.3–4.4.7 |

### 4.5 — Component Library Refresh
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.5.1` | Adopt `shadcn/ui` init — configure with existing Radix + Tailwind setup | S | 4.3.3 |
| `4.5.2` | Replace hand-rolled Button/Input/Card with shadcn variants (keep API compatible) | M | 4.5.1 |
| `4.5.3` | Replace hand-rolled Dialog/Dropdown/Select with shadcn variants | M | 4.5.1 |
| `4.5.4` | Replace hand-rolled Table component with shadcn DataTable (TanStack Table) | M | 4.5.1 |
| `4.5.5` | Update `lucide-react` icons to latest | S | 4.5.1 |

### 4.6 — State & Data Layer
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `4.6.1` | Bump `@tanstack/react-query` to latest v5, `zustand` to v5 | S | 4.2.1 |
| `4.6.2` | Add React Query `queryOptions` helper pattern for type-safe queries | M | 4.6.1 |
| `4.6.3` | Bump `zod` to latest, `react-hook-form` to latest | S | 4.2.1 |

---

## Phase 5: Data Integration & Legal Knowledge (Week 8-12)

> Build the legal knowledge layer. Depends on the AI/ML stack from Phase 3.

### 5.1 — Multi-Jurisdiction Legal Data Ingestion

> Legal corpus ingestion must support multiple jurisdictions from day one. Each data source
> is a pluggable adapter behind a common `CorpusProvider` interface. Tenants configure which
> jurisdictions they need — the platform loads the corresponding adapters and corpora.

| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `5.1.1` | Research: identify best open legal data sources per jurisdiction — document in ADR-005. **Anglo-Saxon**: Caselaw Access Project, CourtListener, BAILII (UK). **French**: Légifrance API, EUR-Lex. **Egyptian**: Egyptian Gazette, Cassation Court databases. Also identify practice-area-specific sources (FIDIC for construction, energy regulatory bodies, sports arbitration — CAS) | M | — |
| `5.1.2` | Define `CorpusProvider` protocol: `search(query, filters) → list[LegalDocument]`, `fetch(document_id) → LegalDocument`, `sync(since) → SyncResult`. All adapters implement this interface | S | 5.1.1 |
| `5.1.3` | Create `CorpusRegistry`: registers available providers per jurisdiction, resolves which adapters to query based on tenant's configured jurisdictions | S | 5.1.2 |
| `5.1.4` | Adapter: `CourtListenerProvider` (US common law — case law, opinions) | M | 5.1.2 |
| `5.1.5` | Adapter: `BAILIIProvider` (UK/Commonwealth common law — case law, legislation) | M | 5.1.2 |
| `5.1.6` | Adapter: `LegifranceProvider` (French civil law — codes, jurisprudence, legislation via open API) | M | 5.1.2 |
| `5.1.7` | Adapter: `EgyptianCorpusProvider` (Egyptian mixed law — civil code, cassation court rulings). Note: may require manual corpus building or partnership if open APIs are limited | M | 5.1.2 |
| `5.1.8` | Qdrant: create `legal_corpus` collection with `jurisdiction` payload field for filtered search (separate from tenant data) | S | 5.1.4 |
| `5.1.9` | Neo4j: create `case_law` subgraph schema (Case → cites → Case, Case → interprets → Statute, Statute → belongs_to → Jurisdiction). Add `jurisdiction` and `legal_system` properties to all nodes | M | 5.1.4 |
| `5.1.10` | Ingestion pipeline: bulk load initial datasets per jurisdiction (start with 5K cases per active jurisdiction for validation) | M | 5.1.8, 5.1.9 |
| `5.1.11` | Incremental sync: scheduled job to pull new cases/rulings from each active adapter | S | 5.1.10 |
| `5.1.12` | Admin API: `GET/POST /api/v1/admin/jurisdictions` — tenant admins enable/disable jurisdictions, configure preferred corpus sources | S | 5.1.3 |

### 5.2 — Knowledge-Enriched RAG
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `5.2.1` | Multi-collection retrieval: query tenant contracts AND legal corpus in parallel, filtered by contract's jurisdiction(s) via `CorpusRegistry` | M | 5.1.10, 3.2.4 |
| `5.2.2` | Source attribution: label each retrieved chunk as "internal", "legal_corpus", or "cross_jurisdiction" with jurisdiction tag and legal system type | S | 5.2.1 |
| `5.2.3` | Legal context injection: when analyzing a clause, retrieve relevant case law interpretations from the matching jurisdiction. For mixed-jurisdiction contracts, retrieve from all applicable jurisdictions and flag conflicts | M | 5.2.1 |
| `5.2.4` | Risk scoring enrichment: ground risk scores in actual litigation outcomes, segmented by jurisdiction (e.g., force majeure enforceability differs between FR Art. 1218 and English common law) | M | 5.2.3 |

### 5.3 — Clause Benchmarking
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `5.3.1` | Extract common clause patterns from legal corpus per jurisdiction and practice area (indemnification, limitation of liability, force majeure, penalty clauses) | M | 5.1.10 |
| `5.3.2` | Build clause similarity index: compare tenant clauses against corpus benchmarks, segmented by jurisdiction + practice area (e.g., "French construction force majeure" vs "English energy limitation of liability") | M | 5.3.1 |
| `5.3.3` | API endpoint: `POST /api/v1/clauses/{id}/benchmark` → returns market comparison within the clause's jurisdiction and practice area context | S | 5.3.2 |
| `5.3.4` | Frontend: clause benchmark widget showing how a clause compares to market standard, with jurisdiction selector to compare across legal systems | M | 5.3.3 |

### 5.4 — AI Evaluation Harness
| PR | Description | Size | Depends On |
|----|-------------|------|------------|
| `5.4.1` | Create `eval/` directory with evaluation framework structure | S | Phase 3 |
| `5.4.2` | Build ground-truth dataset: 50 contracts with manually labeled extractions | M | 5.4.1 |
| `5.4.3` | Extraction accuracy eval: precision/recall/F1 per entity type | M | 5.4.2 |
| `5.4.4` | RAG retrieval eval: recall@k, MRR on curated query set | M | 5.4.2 |
| `5.4.5` | VLM vs OCR comparison eval: side-by-side accuracy on scanned documents | M | 5.4.2, 3.5.9 |
| `5.4.6` | CI integration: run evals on model/prompt changes, fail if metrics regress | S | 5.4.3, 5.4.4 |

---

## Summary: PR Count by Phase

| Phase | PRs | Estimated Weeks | Can Parallelize With |
|-------|-----|-----------------|---------------------|
| **Phase 0: Stabilization** | 14 | 1-2 | — (must go first) |
| **Phase 1: Infrastructure** | 16 | 2-3 | Phase 2 (partial) |
| **Phase 2: Backend** | 21 | 3-4 | Phase 1, Phase 4 |
| **Phase 3: AI/ML (Agent SDK)** | 58 | 5-8 | Phase 4 |
| **Phase 4: Frontend** | 26 | 3-4 | Phase 2, Phase 3 |
| **Phase 5: Data & Integration** | 23 | 4-5 | — (needs Phase 3) |
| **Total** | **158 PRs** | **~12-15 weeks** | |

## Critical Path

```
Phase 0 ──→ 3.1 (Agent SDK + jurisdiction registry) ──→ 3.2 (tool library) ──→ 3.3 (jurisdiction-aware agents)
         │          │                                                              │
         │          │                                                              ├──→ 3.7 (VLM tools) ──→ 5.4 (eval)
         │          │                                                              │
         │          │  Phase 1.1-1.4 (PG17 + Qdrant) ──→ 3.5 (Gemini embed) ─────┤
         │          │                                                              │
         │          │                                                              ├──→ 3.6 (hybrid search) ──→ 5.1 (multi-jurisdiction corpus)
         │          │                                                              │                                │
         │          └──→ 3.1.8-10 (jurisdiction configs) ─────────────────────────┘                                │
         │                                                                                                          │
         │                                                              5.1.2-7 (corpus adapters: CourtListener,   │
         │                                                              BAILII, Légifrance, Egyptian) ──────────────┘
         │
         ├──→ Phase 2.1 (deps) ──→ 2.2 (API cleanup)
         │
         └──→ Phase 4.1 (toolchain) ──→ 4.2 (React 19) ──→ 4.3 (Tailwind v4) ──→ 4.5 (shadcn)
```

**Phase 3 is now the spine of the project.** The Agent SDK foundation (3.1) — including
the jurisdiction registry (3.1.8-10) — unblocks the tool library (3.2), which unblocks
jurisdiction-aware specialized agents (3.3), which unblocks VLM integration (3.7) and
legacy migration (3.9). The jurisdiction plugin architecture flows through to Phase 5.1
where corpus adapters per jurisdiction provide the legal knowledge layer. Infrastructure
(Phase 1) and embeddings (3.5) can progress in parallel.

## Decision Records Needed

Before implementation, these architectural decisions need an ADR (Architecture Decision Record):

| ADR | Question | Phase | Status |
|-----|----------|-------|--------|
| ADR-001 | Valkey vs Redis 8 | 1.3 | PENDING |
| ADR-002 | Temporal vs Dramatiq vs keep Celery | 2.4 | PENDING |
| ~~ADR-003~~ | ~~TanStack Router vs react-router v7~~ | ~~4.4~~ | **DECIDED: TanStack Router** |
| ~~ADR-004~~ | ~~Primary LLM provider~~ | ~~3.1~~ | **DECIDED: Claude Agent SDK** |
| ADR-005 | Multi-jurisdiction legal data source selection (per jurisdiction: Anglo-Saxon, French, Egyptian + practice-area-specific) | 5.1 | PENDING |
| ~~ADR-006~~ | ~~VLM provider default: Claude vision vs Gemini Flash~~ | ~~3.7~~ | **DECIDED: Claude primary, Gemini Flash fallback** |
| ~~ADR-007~~ | ~~Agent state persistence: Redis vs PostgreSQL vs hybrid~~ | ~~3.1~~ | **DECIDED: PostgreSQL primary, Redis hot cache** |
| ADR-008 | Legacy `app/ai/` migration strategy: rewrite vs extract vs deprecate | 3.9 | PENDING |
| ADR-009 | Jurisdiction plugin architecture: config schema, corpus adapter interface, tenant jurisdiction management | 3.1, 5.1 | PENDING |

---

*This is a living document. Update PR status as work progresses.*
