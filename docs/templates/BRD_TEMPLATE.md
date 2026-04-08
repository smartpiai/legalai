# Business Requirements Document

> **Phase**: {phase number and name}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | In Review | Approved | Superseded

---

## 1. Executive Summary

{Complete all three items:}

1. **What is proposed**: {1-2 sentences describing the work}
2. **Why it matters**: {1-2 sentences on the business impact}
3. **The ask**: {engineering effort in person-weeks, infrastructure budget, timeline, and any headcount needs}

## 2. Business Problem

{What problem exists today? What is the cost of inaction?}

### Current State
- {Pain point 1}
- {Pain point 2}

### Desired State
- {e.g., "Contracts are processed within 5 minutes with AI-assisted extraction"}
- {e.g., "Zero manual data entry for standard clause types"}

## 3. Impact of Inaction

| Risk | Category | Estimated Impact |
|------|----------|-----------------|
| {e.g., CVE exposure in unmaintained dependency} | Security | {e.g., Potential data breach, legal liability} |
| {e.g., Cannot support customer requirement X} | Revenue | {e.g., $500K ARR at risk from 3 accounts} |
| {e.g., Manual process does not scale beyond N contracts} | Operational | {e.g., Requires 2 additional FTEs by Q3} |

## 4. Proposed Solution

{High-level description of the work. Link to the roadmap phase.}

### In Scope
- {Item 1}
- {Item 2}

### Out of Scope
- {Item 1 — why excluded}

## 5. Key Assumptions

> These are the conditions that must hold true for this BRD to remain valid. If any assumption is invalidated, re-evaluate the proposal.

| Assumption | Impact if Wrong | How We'll Know |
|------------|----------------|----------------|
| {e.g., Contract volume will exceed 500/month by Q3} | {e.g., ROI timeline extends from 6 months to 18 months} | {e.g., Monthly volume report from sales ops} |
| {e.g., Legal team will adopt AI-assisted review workflow} | {e.g., Zero user adoption, wasted engineering effort} | {e.g., Pilot feedback by Week 6} |
| {e.g., Anthropic API pricing remains stable} | {e.g., Cost model breaks, need to re-evaluate model selection} | {e.g., Monitor Anthropic pricing page and contract terms} |

## 6. Alternatives Considered

> For detailed option analysis, create an [ADR](../templates/ADR_TEMPLATE.md). This section provides a strategic summary including the rationale.

| Alternative | Strategic Rationale | Why Not Chosen |
|-------------|--------------------| ---------------|
| {e.g., Do nothing} | {e.g., Avoid engineering spend} | {e.g., Risks listed in Section 3 are unacceptable} |
| {e.g., Buy vendor solution X} | {e.g., Faster time to market} | {e.g., Does not support multi-tenant isolation or custom AI models} |
| {e.g., Partial implementation (Phase 1 only)} | {e.g., Reduce initial investment} | {e.g., Insufficient to meet compliance deadline} |

## 7. Cost Estimate

| Category | Estimate | Notes |
|----------|----------|-------|
| Engineering effort | {e.g., 12 person-weeks} | {e.g., 2 backend, 1 frontend, 1 ML engineer for 3 weeks} |
| Infrastructure (one-time) | {e.g., $2,000} | {e.g., Qdrant cluster provisioning, staging environment} |
| Infrastructure (recurring) | {e.g., $800/month} | {e.g., GPU inference, vector DB hosting, API costs} |
| Opportunity cost | {e.g., Delays Feature Y by 2 weeks} | {e.g., Same team owns both; cannot parallelize} |

## 8. Expected Return

| Benefit | Quantification | Timeframe |
|---------|---------------|-----------|
| {e.g., Reduced review time} | {e.g., 35 min saved per contract x 500 contracts/month = 291 hours/month} | {e.g., Within 3 months of launch} |
| {e.g., Revenue enablement} | {e.g., Unblocks $500K ARR from 3 accounts requiring AI-assisted review} | {e.g., Q3 2026} |
| {e.g., Avoided headcount} | {e.g., Eliminates need for 2 additional FTEs at $150K/yr each} | {e.g., By Q4 2026} |

**Estimated payback period**: {e.g., "4 months based on engineering cost vs. operational savings"}

## 9. Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|-------------|
| {e.g., Extraction accuracy} | {e.g., 78%} | {e.g., 95%} | {e.g., Eval harness F1 score} |
| {e.g., Build pass rate} | {e.g., 72%} | {e.g., 100%} | {e.g., CI dashboard} |

## 10. Stakeholder Impact

| Stakeholder | Impact | Communication Plan |
|-------------|--------|-------------------|
| {e.g., Engineering} | {e.g., 2-week stabilization sprint} | {e.g., Sprint planning} |
| {e.g., Product} | {e.g., No feature work during Phase 0} | {e.g., Roadmap review} |

## 11. Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| {e.g., PG 17 migration breaks queries} | Medium | High | {Run full migration test suite in staging first} |

## 12. Timeline

| Milestone | Target Date | Owner | Tracked In |
|-----------|------------|-------|------------|
| {Phase kickoff} | {date} | {name} | [{PROJ-NNN}]({issue tracker URL}) |
| {Phase complete} | {date} | {name} | [{PROJ-NNN}]({issue tracker URL}) |

## 13. Related Documents

| Document | Link |
|----------|------|
| PRD | [PRD](../phase-{X}/{X.X}_prd_{name}.md) |
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| ADR | [ADR](../phase-{X}/{X.X}_adr_{name}.md) |
| {Other} | [{Title}]({relative path}) |

## 14. Approval

| Role | Name | Date | Decision | Conditions / Notes |
|------|------|------|----------|--------------------|
| {Tech Lead} | | | Pending | |
| {Product Owner} | | | Pending | |
| {Engineering Manager} | | | Pending | |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial draft | {name} |
| {YYYY-MM-DD} | {e.g., Updated cost estimates after scoping} | {name} |
| {YYYY-MM-DD} | {e.g., Approved} | {name} |
