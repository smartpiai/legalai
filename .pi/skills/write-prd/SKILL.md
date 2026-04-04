---
name: write-prd
description: Guide through creating a Product Requirements Document with user stories, AI behavior specs, UX requirements, and success metrics
---

# Write a Product Requirements Document (PRD)

You are helping the user create a PRD. The PRD answers: **"What should the user experience?"** It requires an approved BRD upstream.

## Before You Start

1. Read the template: `docs/templates/PRD_TEMPLATE.md`
2. Check for an existing BRD for this phase — warn if missing (upstream dependency)
3. Check if a PRD already exists for this feature
4. Determine phase number, feature name, and file naming

## Authorship

- **Primary author**: Product Owner / PM
- **Co-contributors**: UX Designer, Tech Lead, Data/ML Engineer (for AI sections)
- **Approvers**: Product Owner + Tech Lead
- **Consumers**: Engineering (implementers), QA, UX, Customer Success

## Naming

```
docs/phase-{N}/{N.X}_prd_{feature-name}.md
```

## Workflow

### 1. Problem Statement
Ask: "What user problem does this solve? Who experiences it? How often?"
Push for cost of inaction — connect back to the BRD.

### 2. Prior Art / Alternatives
Ask: "What do users do today? What competitor tools exist? Why is our approach better?"
Structure as a comparison table.

### 3. User Stories
Help write specific user stories. Push beyond generic templates:
- Who is the persona? (Contract Manager, General Counsel, etc.)
- What is the specific action? (Not "manage contracts" but "compare indemnification clauses across vendor MSAs")
- What measurable outcome results?

### 4. Requirements Tables
**Functional**: Each requirement needs an ID, priority (P0/P1/P2), and testable acceptance criteria.
**Non-Functional**: Quantified targets (not "fast" but "< 3s p95").

### 5. AI Behavior Requirements (if applicable)
This is the most critical section for this legal AI platform. Guide through:
- **Model Selection**: Which model for which capability and why
- **Confidence Thresholds**: Minimum confidence per operation, behavior below threshold
- **Fallback Behavior**: What happens when AI fails or is uncertain
- **Explainability**: Citation requirements, reasoning traces
- **Human-in-the-Loop Triggers**: When does a human need to review?
- **Hallucination Handling**: Detection, grounding, containment
- **Cost Budget**: Per-invocation cost, monthly budget cap

### 6. User Experience
Help create a Mermaid flowchart showing the happy path, error branches, and AI confidence branching.
Build the UI State Matrix: every screen/component in Empty, Loading, Error, Populated, and Edge states.

### 7. Accessibility
Ensure WCAG 2.1 AA requirements are specific to this feature.

### 8. Analytics & Instrumentation
Define events that measure adoption: feature.started, ai_result.accepted, ai_result.edited, ai_result.rejected.

### 9-15. Remaining Sections
Complete: User Onboarding, Dependencies, Success Metrics, Out of Scope, Open Questions, Related Documents, Version History.

## Quality Checklist

- [ ] Every functional requirement has testable acceptance criteria
- [ ] AI behavior section covers confidence thresholds, fallbacks, and hallucination handling
- [ ] UI State Matrix covers all 5 states for every screen/component
- [ ] Success metrics have baselines and targets
- [ ] Edge cases section addresses: AI timeout, low confidence, unsupported formats, concurrent users
- [ ] Accessibility requirements are feature-specific, not generic WCAG copy-paste
- [ ] BRD is linked in Related Documents
- [ ] Status is "Draft"
