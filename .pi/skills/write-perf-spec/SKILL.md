---
name: write-perf-spec
description: Guide through creating a Performance Specification with latency budgets, cost projections, load profiles, degradation tiers, and capacity planning
---

# Write a Performance Specification

You are helping the user create a Perf Spec. The Perf Spec answers: **"What are the performance requirements?"** It requires a Tech Spec upstream.

## Before You Start

1. Read the template: `docs/templates/PERF_SPEC_TEMPLATE.md`
2. Check for the upstream Tech Spec — performance targets should match the design
3. Baselines MUST be measured before this spec is approved — no guessing

## Authorship

- **Primary author**: SRE / Performance Engineer
- **Co-contributors**: Tech Lead, Backend + Frontend Engineers
- **Approvers**: Tech Lead + SRE
- **Consumers**: SRE (monitoring), Engineers (CI thresholds), PM/Finance (cost projections)

## Naming

```
docs/phase-{N}/{N.X}_perf-spec_{component-name}.md
```

## Workflow

### 1. Overview
What performance characteristics are being specified? What's the user-facing impact?
Define SLO vs SLA for this context.

### 2. Load Profile
Characterize "normal" and "peak": request rates, geographic distribution, tenant size distribution, concurrent users.

### 3. Performance Budgets
**Latency**: p50, p95, p99, hard limit for each operation. Label as SLO or SLA.
**Cold Start vs Warm**: First-request penalty vs steady-state.
**Throughput**: Target operations/time at specified concurrency.
**Resource Consumption**: Token cost, memory, bundle size.

### 4. Cost Projections
Current and 6-month projected costs per operation. Include total monthly cost.

### 5. Client-Side Budgets (if frontend)
Core Web Vitals: FCP, LCP, CLS, INP. Bundle size per route.

### 6. Baselines (REQUIRED)
Measure current performance before setting targets. No spec approval without baselines.

### 7. Benchmark Design
Define: environment, dataset, concurrency, duration, tool.
List test scenarios with key metrics.

### 8. Regression Thresholds
For each metric: allowed regression percentage and action if exceeded (block merge, investigate, alert).

### 9-13. Remaining Sections
Monitoring, Capacity Planning, Graceful Degradation Tiers, Optimization Opportunities, Related Documents.

## Quality Checklist

- [ ] Baselines are measured, not guessed
- [ ] Every target is labeled SLO or SLA
- [ ] Cost projections include 6-month horizon
- [ ] Regression thresholds are defined with CI actions
- [ ] Graceful degradation tiers define what sheds at each level
- [ ] Capacity planning identifies when scaling actions are needed
- [ ] Benchmark design is reproducible (exact environment, dataset, tool)
- [ ] Client-side budgets include Core Web Vitals (if frontend)
