---
name: write-tech-spec
description: Guide through creating a Technical Specification with architecture diagrams, data models, state machines, error handling, and rollout plans
---

# Write a Technical Specification

You are helping the user create a Tech Spec. The Tech Spec answers: **"How does the implementation work?"** It is the pivot point in the document chain — it consumes PRD requirements and produces all downstream engineering artifacts.

## Before You Start

1. Read the template: `docs/templates/TECH_SPEC_TEMPLATE.md`
2. Check for upstream dependencies: PRD should exist (warn if missing)
3. If an ADR was needed for a design decision, it should exist too
4. Identify the phase, sub-number, and component name

## Authorship

- **Primary author**: Senior Engineer assigned to the feature
- **Reviewers**: Tech Lead + peer engineers
- **Consumers**: Implementing engineers, code reviewers, QA, SRE

## Naming

```
docs/phase-{N}/{N.X}_tech-spec_{component-name}.md
```

## Workflow

### 1. Overview
Ask: "What is being built or changed? 2-3 sentences."
Then: "What are the explicit goals and non-goals?"

### 2. Background
Ask: "What existing code is being modified?" Get specific file paths.
Link to any ADR if a decision was made.

### 3. Design — Architecture
**A component interaction diagram is required.** Help the user create a Mermaid diagram showing:
- Components and their relationships
- Data stores
- External services
- Communication protocols (REST, WebSocket, async)

### 3. Design — Data Flow
Create a Mermaid flowchart showing input → processing steps → output.

### 3. Design — Key Components
For each component:
- Responsibility (one sentence)
- Interface (Python class/method signatures with types)
- Behavioral rules

### 3. Design — State Machines
If any entity has discrete states, create a Mermaid stateDiagram with:
- States, transitions, entry conditions, side effects
Ask: "Does anything in this feature have a lifecycle? (e.g., processing states, approval states)"

### 3. Design — Concurrency Model
Ask: "How does this handle concurrent access?"
Cover: async pattern, shared state, race conditions, connection pooling, deadlock prevention.

### 4. Data Model Changes
Ask: "Any new tables, columns, or indexes?"
Show SQL for schema changes. If none, mark N/A.

### 5. Rejected Approaches
Ask: "What alternatives were considered and why were they rejected?"
Link to ADR if one exists.

### 6. API Changes
If API changes exist, summarize and link to ID Spec.

### 7. Error Handling
Classify errors: Transient (retry), Recoverable (degrade), Fatal (fail fast).
Show the error propagation chain.

### 8-14. Remaining Sections
Complete: Security, Performance, Observability, AI Considerations, Testing Strategy, Rollout Plan, Feature Flags, Open Questions, Related Documents, Version History.

## Quality Checklist

- [ ] Architecture diagram exists and is accurate (Mermaid)
- [ ] Every new component has a defined interface with types
- [ ] Concurrency model is explicit (not just "we use async")
- [ ] Error handling classifies each error and shows propagation
- [ ] Data model changes include SQL and migration plan
- [ ] Rejected approaches explain WHY, not just WHAT
- [ ] Observability section defines metrics, logs, and traces
- [ ] Feature flags have "Cleanup By" dates
- [ ] Open questions have owners and target dates
- [ ] All upstream docs (PRD, ADR) are linked
- [ ] Status is "Draft"
