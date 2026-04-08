---
name: write-brd
description: Guide through creating a Business Requirements Document with proper business justification, cost analysis, and stakeholder impact
---

# Write a Business Requirements Document (BRD)

You are helping the user create a BRD. The BRD answers: **"Why are we doing this work?"** It is the first document in the dependency chain and gates phase kickoff.

## Before You Start

1. Read the template: `docs/templates/BRD_TEMPLATE.md`
2. Check if a BRD already exists for this phase by scanning `docs/phase-{N}/` for `*_brd_*.md`
3. Determine the phase number and a short name for the file

## Authorship

- **Primary author**: Product Owner / PM
- **Approvers**: CTO / VP Engineering + Engineering Manager
- **Consumers**: Engineering (scoping), Finance (budget approval), Legal (compliance items)

## Naming

```
docs/phase-{N}/{N}_brd_{short-name}.md
```

Example: `docs/phase-1/1_brd_infrastructure-upgrades.md`

## Workflow

Guide the user through these sections in order. For each section, ask targeted questions to extract the information needed.

### 1. Executive Summary
Ask: "In 1-2 sentences, what work is being proposed and why does it matter to the business?"
Then ask: "What's the engineering effort estimate (person-weeks), infrastructure cost, and timeline?"

### 2. Business Problem
Ask: "What problem exists today? What are the specific pain points?"
Ask: "What is the cost of NOT doing this work? (Revenue at risk, compliance exposure, operational burden)"

### 3. Impact of Inaction
Help structure as a table with Risk, Category (Security/Revenue/Operational/Compliance), and Estimated Impact. Push for quantified impacts, not vague statements.

### 4. Proposed Solution
Ask: "At a high level, what work will be done? What's in scope and what's explicitly excluded?"

### 5. Key Assumptions
For each assumption, ask: "What happens if this is wrong?" and "How will we know if it's wrong?"
Structure as: Assumption | Impact if Wrong | How We'll Know

### 6. Alternatives Considered
Push for at least: Do Nothing, Buy vs Build, and Partial Implementation. For each, require a strategic rationale and why it was rejected.

### 7. Cost Estimate
Break down: Engineering effort, One-time infrastructure, Recurring infrastructure, Opportunity cost.
Ask: "What other work gets delayed because of this?"

### 8. Expected Return
Push for quantified benefits with timeframes. Calculate payback period.
Ask: "When does this investment pay for itself?"

### 9. Success Metrics
For each metric, require: Current baseline, Target, How it's measured.
Reject vague metrics like "improved performance" — demand numbers.

### 10-14. Remaining Sections
Complete: Stakeholder Impact, Dependencies & Risks, Timeline, Related Documents, Approval table.

## Quality Checklist

Before finalizing, verify:
- [ ] Every claim in "Expected Return" has a number and timeframe
- [ ] "Impact of Inaction" has at least one quantified risk
- [ ] "Assumptions" each have "Impact if Wrong" and "How We'll Know"
- [ ] "Alternatives Considered" includes "Do Nothing"
- [ ] Cost estimate includes opportunity cost
- [ ] Success metrics have baselines and measurable targets
- [ ] Timeline has owners and tracking issues
- [ ] Related Documents table links to downstream PRD/Tech Spec (even if they don't exist yet — note as "To be created")
- [ ] Version History table is present
- [ ] Status is set to "Draft"
