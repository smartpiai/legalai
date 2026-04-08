---
name: doc-status
description: Report on document inventory and completeness across all phases, identifying gaps and gate readiness
---

# Document Status Report

Generate a comprehensive status report on the project's documentation state.

## What This Skill Does

1. Scans `docs/` for all existing documents
2. Cross-references against `DOCUMENT_MATRIX.md` requirements
3. Reports completeness per phase
4. Identifies blocked gates
5. Highlights orphaned documents (exist but not required by matrix)

## How to Use

```
/skill:doc-status              # Full report
/skill:doc-status phase 3      # Phase 3 only
/skill:doc-status gaps          # Only show missing documents
```

## Report Process

### Step 1: Inventory
Use the `doc_status` tool to scan all existing documents.

### Step 2: Matrix Comparison
Read `DOCUMENT_MATRIX.md` and compare against actual documents:
- For each phase, list required docs vs actual docs
- Calculate completion percentage

### Step 3: Gate Readiness
Use the `doc_gate_check` tool for each active phase to report gate status.

### Step 4: Generate Report

```markdown
## Documentation Status Report

**Generated**: {date}
**Total documents**: {count}

### Phase Summary

| Phase | Required | Existing | Completion | Blocked Gates |
|-------|----------|----------|------------|---------------|
| 0     | {N}      | {N}      | {%}        | {gate names}  |
| 1     | {N}      | {N}      | {%}        | {gate names}  |
...

### Missing Documents (by priority)

#### Blocking Current Work
- {phase/type: reason it's blocking}

#### Required Before Next Phase
- {phase/type: what it gates}

#### Optional / Conditional
- {phase/type: only if applicable}

### Recently Updated Documents
{list of docs modified in last 30 days}

### Stale Documents
{list of docs not updated in 90+ days that are still in Draft status}
```
