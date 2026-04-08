---
name: write-adr
description: Guide through creating an Architecture Decision Record with options analysis, assumptions tracking, and review-by dates
---

# Write an Architecture Decision Record (ADR)

You are helping the user create an ADR. The ADR answers: **"Which option did we pick and why?"** Only create an ADR when there's a genuine choice between alternatives.

## Before You Start

1. Read the template: `docs/templates/ADR_TEMPLATE.md`
2. Check existing ADRs to avoid duplicate decisions: scan `docs/phase-*/` for `*_adr_*.md`
3. Confirm there is actually a decision to make — if there's only one viable option, document inline in the Tech Spec instead

## Authorship

- **Primary author**: Tech Lead or Senior Engineer
- **Approvers**: Tech Lead + affected team leads
- **Consumers**: All engineers (present and future), new hires during onboarding

## Naming

```
docs/phase-{N}/{N.X}_adr_{decision-name}.md
```

ADRs are numbered sequentially: ADR-001, ADR-002, etc. The number goes in the document title, not the filename.

## Workflow

### 1. Context
Ask: "What technical or business situation requires a decision? What constraints exist?"
This should be understandable by someone who joins the team 18 months from now.

### 2. Assumptions
This is the most important section. For each assumption:
- Make it concrete and falsifiable (not "API will be fast" but "Anthropic API p95 < 1s")
- Identify who monitors it (Decision Owner)
- Ask: "If this assumption breaks, does the decision still hold?"

### 3. Scope
Ask: "What specific systems, services, or components are affected?"
Be concrete: service names, file paths, infrastructure components.

### 4. Decision Drivers
Ask: "What are the top 3 forces pushing this decision?" Examples:
- Unmaintained dependency, security vulnerability, team skill gap, performance requirement, cost constraint

### 5. Options
For each option, require:
- Description of the approach
- Concrete pros and cons (not generic)
- Effort estimate (S/M/L)
- Risk level (Low/Medium/High)

**Important**: Do NOT fabricate options to fill the template. If only one option is viable, state why alternatives were ruled out. The template explicitly says: "A single well-justified option is better than padding with strawmen."

### 6. Decision
One sentence linking the chosen option back to the decision drivers.

### 7. Consequences
Separate into Positive, Negative, and Trade-offs.
Ask: "What are we explicitly accepting as a downside of this choice?"

### 8. Review-By Date
Ask: "When should we revisit this decision?" Set a concrete date.
The Decision Owner is responsible for triggering the review.

## Quality Checklist

- [ ] Assumptions are concrete, falsifiable, and have a named monitor
- [ ] Decision Drivers are specific to this project, not generic
- [ ] Options are genuine alternatives, not strawmen
- [ ] Pros/Cons are concrete and specific, not "better" or "worse"
- [ ] Decision rationale links back to Decision Drivers
- [ ] Consequences include accepted trade-offs and risks
- [ ] Review-By date is set
- [ ] Decision Owner is named
- [ ] Follow-Up Actions have tracking issues
- [ ] Status is "Draft" or "Proposed"
