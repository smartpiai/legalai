---
name: review-doc
description: Review an existing document against its template for completeness, quality, and adherence to organizational standards
---

# Review a Document

You are helping the user review an existing document against its template and organizational standards.

## How to Use

Provide the path to the document to review:
```
/skill:review-doc docs/phase-1/1.2.1_tech-spec_pgvector-schema.md
```

## Review Process

### Step 1: Identify Document Type
Parse the filename to determine the doc type (e.g., `tech-spec`, `brd`, `sec-review`).

### Step 2: Load the Template
Read the corresponding template from `docs/templates/` to understand required sections.

### Step 3: Structural Completeness
Check that every section from the template exists in the document.
For each missing section, report whether it should be added or marked N/A.

### Step 4: Content Quality
For each section that exists, evaluate:

**Headers & Metadata:**
- [ ] Status field is present and valid
- [ ] Phase and PR numbers are filled
- [ ] Author and date are set

**Upstream Dependencies:**
- [ ] Related Documents table links to upstream docs
- [ ] Upstream docs actually exist (use `doc_validate` tool)

**Content Depth:**
- [ ] Tables have real data, not just placeholder `{...}` text
- [ ] Examples are realistic, not copy-pasted from template
- [ ] Metrics and targets are quantified (not "fast" or "good")
- [ ] Assumptions are falsifiable
- [ ] Risks have likelihood AND impact

**Cross-References:**
- [ ] Internal links resolve
- [ ] Referenced files/paths exist in the codebase
- [ ] Issue tracker links are present where required

**Version History:**
- [ ] Version History table exists
- [ ] At least one entry (initial draft)

### Step 5: Role-Specific Review

Based on the document type, apply additional criteria:

**BRD**: Does "Impact of Inaction" have quantified risks? Is the payback period calculated?
**PRD**: Does every functional requirement have testable acceptance criteria? Is the AI behavior section complete?
**ADR**: Are assumptions concrete and falsifiable? Is a Review-By date set?
**Tech Spec**: Does the architecture diagram exist? Is the concurrency model explicit?
**Test Spec**: Are fault injection tests included? Is the flaky test policy defined?
**ID Spec**: Does every endpoint have both JSON examples and Pydantic schemas?
**Mig Guide**: Is Point of No Return marked? Are dry-run results documented?
**Runbook**: Does the Quick Reference Card have 5 working commands?
**Sec Review**: Does the AI/LLM section cover all 7 threat categories?
**Dep Review**: Is supply chain health assessed? Is a fallback plan defined?
**Perf Spec**: Are baselines measured (not guessed)? Are degradation tiers defined?

### Step 6: Generate Report

Output a structured review report:

```markdown
## Document Review: {filename}

### Overall Grade: {A/B/C/D/F}

### Structural Completeness: {X}/{Y} sections present

### Issues Found

#### Critical (must fix before approval)
1. {issue}

#### Important (should fix)
1. {issue}

#### Minor (nice to have)
1. {issue}

### Strengths
- {what the document does well}

### Recommended Actions
1. {specific action with section reference}
```
