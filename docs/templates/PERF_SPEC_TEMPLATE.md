# Performance Specification

> **Title**: {feature or component}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | Baselined | Monitoring

---

## 1. Overview

{What performance characteristics are being specified? What is the user-facing impact?}

### SLO vs. SLA Definitions

- **SLO (Service Level Objective)**: Internal targets the team commits to. Missing an SLO triggers investigation and remediation.
- **SLA (Service Level Agreement)**: Contractual commitments to customers. Missing an SLA has legal/financial consequences.

All targets below are labeled as SLO or SLA. When no SLA exists, the SLO still applies as the engineering standard.

## 2. Load Profile

{What does "normal" and "peak" traffic look like?}

| Parameter | Value |
|-----------|-------|
| Typical request rate | {e.g., 50 req/min across all tenants} |
| Peak multiplier | {e.g., 3x during business hours, 5x during quarter-end} |
| Geographic distribution | {e.g., 70% US, 20% EU, 10% APAC} |
| Tenant size distribution | {e.g., 5 large tenants (1000+ contracts), 50 medium (100-1000), 200 small (< 100)} |
| Concurrent users per tenant | {e.g., 5-20 for large, 1-5 for medium, 1-2 for small} |

## 3. Performance Budgets

### Latency

| Operation | p50 Target | p95 Target | p99 Target | Hard Limit | Type |
|-----------|-----------|-----------|-----------|------------|------|
| {e.g., ExtractionAgent invoke} | {2s} | {5s} | {8s} | {15s timeout} | SLO |
| {e.g., Hybrid search query} | {100ms} | {300ms} | {500ms} | {2s timeout} | SLA |
| {e.g., VLM page extraction} | {1s} | {3s} | {5s} | {10s timeout} | SLO |

### Cold Start vs. Warm Performance

| Operation | Cold (first request) | Warm (cached/pooled) | Notes |
|-----------|---------------------|---------------------|-------|
| {e.g., Agent invoke} | {e.g., +3s for model loading / connection pool} | {e.g., Within budget above} | {e.g., Pool pre-warmed on deploy} |
| {e.g., Vector search} | {e.g., +500ms for collection loading} | {e.g., Within budget above} | {e.g., Warm via startup probe} |

### Throughput

| Operation | Target | Concurrency | Type |
|-----------|--------|-------------|------|
| {e.g., Document ingestion} | {50 docs/min} | {10 parallel workers} | SLO |
| {e.g., Agent invocations} | {20 req/min per tenant} | {5 concurrent per tenant} | SLA |

### Resource Consumption

| Resource | Budget | Measurement | Type |
|----------|--------|-------------|------|
| {e.g., Token cost per extraction} | {< $0.10 per document} | {Anthropic API usage tracking} | SLO |
| {e.g., Memory per agent session} | {< 100MB} | {Process RSS monitoring} | SLO |
| {e.g., Frontend bundle size} | {< 500KB gzipped} | {vite build output} | SLO |

## 4. Cost Projections

| Operation | Cost / Unit | Current Monthly Volume | Projected Volume (6 mo) | Current Monthly Cost | Projected Monthly Cost |
|-----------|------------|----------------------|------------------------|---------------------|----------------------|
| {e.g., Contract extraction} | {$0.08} | {5,000} | {25,000} | {$400} | {$2,000} |
| {e.g., Embeddings} | {$0.001} | {50,000} | {250,000} | {$50} | {$250} |
| {e.g., Search queries} | {$0.002} | {100,000} | {500,000} | {$200} | {$1,000} |
| **Total** | | | | **{$650}** | **{$3,250}** |

## 5. Client-Side Performance Budgets

> Mark `N/A` if this spec does not affect the frontend.

| Metric | Target | Measurement Tool |
|--------|--------|-----------------|
| First Contentful Paint (FCP) | {e.g., < 1.5s} | {e.g., Lighthouse / Web Vitals} |
| Largest Contentful Paint (LCP) | {e.g., < 2.5s} | {e.g., Lighthouse / Web Vitals} |
| Cumulative Layout Shift (CLS) | {e.g., < 0.1} | {e.g., Lighthouse / Web Vitals} |
| Interaction to Next Paint (INP) | {e.g., < 200ms} | {e.g., Lighthouse / Web Vitals} |
| JS bundle size (gzipped) | {e.g., < 500KB total, < 150KB per route chunk} | {e.g., `vite build --report`} |
| Time to Interactive (TTI) | {e.g., < 3s on 4G} | {e.g., Lighthouse with throttling} |

## 6. Baselines

> **Required before this spec is approved.** If no baseline exists, run the benchmark first and fill in this section.

| Operation | Current p50 | Current p95 | Measured On | Environment |
|-----------|------------|------------|-------------|-------------|
| {operation} | {value} | {value} | {date} | {staging / production} |

**Baseline refresh cadence**: {e.g., "Re-measure after each phase completion or after any architectural change. Minimum quarterly."}

## 7. Benchmark Design

### Test Setup

| Parameter | Value |
|-----------|-------|
| Environment | {e.g., Docker compose on 8-core / 16GB machine} |
| Dataset | {e.g., 100 contracts, mixed types} |
| Concurrency | {e.g., 5 simultaneous requests} |
| Duration | {e.g., 5 minute sustained load} |
| Tool | {e.g., k6 / locust / custom script} |

### Test Scenarios

| Scenario | Description | Key Metric |
|----------|-------------|------------|
| {S1: Baseline throughput} | {Sequential agent calls, no concurrency} | {requests/sec} |
| {S2: Concurrent load} | {5 concurrent agent calls} | {p95 latency} |
| {S3: Large document} | {100-page contract through VLM pipeline} | {total processing time} |

## 8. Regression Thresholds

| Metric | Allowed Regression | Action if Exceeded |
|--------|-------------------|-------------------|
| {p95 latency} | {< 10% increase} | {Block merge, investigate} |
| {Token cost per doc} | {< 20% increase} | {Review prompt, flag to team} |
| {Bundle size} | {< 5% increase} | {Block merge, tree-shake} |

## 9. Monitoring in Production

| Metric | Dashboard | Alert Condition |
|--------|-----------|-----------------|
| {Agent latency} | {Grafana: Agent Performance} | {p95 > 2x target for 10 min} |
| {Token cost} | {Custom: Cost Tracker} | {Hourly cost > $50} |
| {Error rate} | {Grafana: Error Rate} | {> 1% for 5 min} |

## 10. Capacity Planning

| Resource | Current Capacity | Projected Limit | When We Hit It | Scaling Action |
|----------|-----------------|-----------------|----------------|----------------|
| {e.g., Database connections} | {e.g., 100 pool} | {e.g., Max 200} | {e.g., ~500 concurrent users} | {e.g., PgBouncer or increase pool} |
| {e.g., Qdrant memory} | {e.g., 8GB} | {e.g., 32GB at 1M vectors} | {e.g., ~6 months at current growth} | {e.g., Vertical scale or sharding} |
| {e.g., API compute} | {e.g., 4 replicas} | {e.g., 8 replicas within budget} | {e.g., ~1000 concurrent users} | {e.g., HPA with CPU target 70%} |

## 11. Graceful Degradation Tiers

> What gets shed under load? Define the order of operations when the system is stressed.

| Tier | Trigger Condition | What Degrades | User Impact | Auto / Manual |
|------|-------------------|---------------|-------------|---------------|
| 1 — Elevated | {e.g., p95 > 1.5x target for 5 min} | {e.g., Disable non-essential background jobs} | {e.g., Delayed email notifications} | Auto |
| 2 — High | {e.g., p95 > 2x target for 5 min} | {e.g., Disable real-time dashboard updates, serve cached results} | {e.g., Data up to 60s stale} | Auto |
| 3 — Critical | {e.g., p95 > 3x target OR error rate > 5%} | {e.g., Reject new AI processing requests, queue them} | {e.g., "Processing delayed" banner, results delivered async} | Manual approval |
| 4 — Survival | {e.g., Service at risk of OOM / crash} | {e.g., Shed all AI endpoints, serve only read-only contract views} | {e.g., AI features unavailable} | Manual |

## 12. Optimization Opportunities

{Known areas where performance can be improved if budgets are exceeded.}

| Opportunity | Expected Improvement | Effort | Trade-off |
|-------------|---------------------|--------|-----------|
| {e.g., Cache Qdrant results} | {-40% search latency} | S | {Stale results for 60s} |
| {e.g., Use Gemini Flash for classification} | {-60% VLM cost} | S | {Slightly lower accuracy} |
| {e.g., Batch embedding calls} | {-30% embedding cost} | M | {Higher latency for single docs} |

## 13. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Test Spec | [Test Spec](../phase-{X}/{X.X}_test-spec_{name}.md) |
| Baseline measurement data | [{Title}]({path}) |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial draft | {name} |
| {YYYY-MM-DD} | {e.g., Baselines recorded after Phase 0} | {name} |
| {YYYY-MM-DD} | {e.g., Updated budgets after load test results} | {name} |
