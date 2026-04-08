---
name: write-mig-guide
description: Guide through creating a Migration Guide with step-by-step procedures, rollback plans, dry-run results, and monitoring during migration
---

# Write a Migration Guide

You are helping the user create a Migration Guide. The Migration Guide answers: **"How do we migrate data/schemas safely?"** It requires a Tech Spec upstream.

## Before You Start

1. Read the template: `docs/templates/MIG_GUIDE_TEMPLATE.md`
2. Check for the upstream Tech Spec — the migration implements a design change
3. This document MUST be tested in staging before production approval

## Authorship

- **Primary author**: SRE / Infrastructure Engineer
- **Co-contributors**: Backend Engineer (data migration), DBA (schema changes)
- **Approvers**: SRE + Tech Lead
- **Consumers**: Migration executor (SRE / on-call), Eng Manager (downtime comms)

## Naming

```
docs/phase-{N}/{N.X}_mig-guide_{migration-name}.md
```

## Workflow

### 1. Overview
Ask: "What is being migrated? From what state to what state?"
Structure as a Before/After table.

### 2. Pre-Migration Checklist
Ensure: backup, team notification, staging parity, dry-run, rollback tested.

### 3. Migration Steps
For EACH step:
- Duration estimate and who executes it
- Exact command(s)
- Expected output
- Verification command
- **Point of No Return**: mark the exact step where rollback becomes restore-from-backup

Ask: "Which steps can run in parallel? Which must be sequential?"

### 4. Live Monitoring
Ask: "What dashboards should be open? What metrics should be watched? At what threshold do we abort?"

### 5. Dry Run Results
This section must be filled BEFORE production approval. Record: date, environment, duration, result, issues found.

### 6. Data Migration
If data moves between stores: source, destination, method, estimated duration, validation queries.

### 7. Rollback Procedure
Define: who can call rollback, trigger conditions, exact rollback steps, verification.

### 8-12. Remaining Sections
Complete: Post-Migration Verification, Downtime Estimate, Feature Flag Coordination, Communication Plan, Related Documents.

## Quality Checklist

- [ ] Every step has an exact command (not "update the database")
- [ ] Every step has expected output and verification
- [ ] Point of No Return is marked (if applicable)
- [ ] Rollback procedure has exact commands
- [ ] Dry run results are documented (required before production)
- [ ] Live monitoring has abort conditions
- [ ] Communication plan has who/when/message for before, after, and rollback
- [ ] Duration estimates are based on staging dry-run, not guesses
- [ ] Decision authority for rollback is named
