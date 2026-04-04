# Migration Guide

> **Title**: {what is being migrated}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Draft | Tested in Staging | Approved for Production

---

## 1. Overview

{What is being migrated? From what state to what state?}

| Aspect | Before | After |
|--------|--------|-------|
| {e.g., PostgreSQL version} | {15} | {17} |
| {e.g., Task queue} | {Celery} | {Temporal} |

## 2. Pre-Migration Checklist

- [ ] Backup current database / state
- [ ] Notify affected teams
- [ ] Verify staging environment matches production
- [ ] Run migration dry-run in staging
- [ ] Confirm rollback procedure tested
- [ ] {Additional prerequisite}

## 3. Migration Steps

### Parallelism Guidance

> Indicate which steps can run concurrently. Example: "Steps 2-4 can run concurrently. Step 5 must wait for all of 2-4 to complete." If all steps are strictly sequential, state: "All steps must run sequentially in the order listed."

### Step 1: {Description}

| Duration Estimate | Executor |
|-------------------|----------|
| {e.g., ~5 min} | {CI / SRE / Developer} |

```bash
# Command or code
{command}
```

**Expected output**: {what you should see}

**Verification**: {how to confirm this step succeeded}

### Step 2: {Description}

| Duration Estimate | Executor |
|-------------------|----------|
| {e.g., ~10 min} | {CI / SRE / Developer} |

> **POINT OF NO RETURN**: After this step, rollback requires restoring from backup rather than a simple revert.

Use the callout above at the exact step where the migration becomes irreversible. Place it **before** the command block so the executor sees it before running. Not every migration has a point of no return — only include it where it genuinely applies (e.g., destructive schema changes, data transformations that drop the original format).

```bash
{command}
```

**Expected output**: {what}

**Verification**: {how}

### Step 3: {Description}

| Duration Estimate | Executor |
|-------------------|----------|
| {e.g., ~2 min} | {CI / SRE / Developer} |

```bash
{command}
```

**Expected output**: {what}

**Verification**: {how}

{Continue pattern for additional steps...}

## 4. Live Monitoring During Migration

> What should the executor watch while the migration is running? Open these dashboards before starting Step 1.

| Dashboard / Query | What to Watch | Abort If |
|-------------------|---------------|----------|
| {e.g., Grafana: API Error Rate} | {e.g., Error rate should stay < 0.5%} | {e.g., Error rate > 2% for 5 min} |
| {e.g., `SELECT count(*) FROM pg_stat_activity`} | {e.g., Active connections should not spike > 100} | {e.g., Connections > 200} |
| {e.g., Grafana: Database Replication Lag} | {e.g., Lag should stay < 1s} | {e.g., Lag > 30s} |

## 5. Dry Run Results

> **Required before production approval.** Document the staging dry-run outcomes here.

| Run | Date | Environment | Duration | Result | Issues Found | Sign-off |
|-----|------|-------------|----------|--------|--------------|----------|
| 1 | {YYYY-MM-DD} | {staging} | {e.g., 15 min} | {Pass/Fail} | {e.g., Step 3 failed due to missing index} | {name} |
| 2 | {YYYY-MM-DD} | {staging} | {e.g., 12 min} | {Pass} | {None} | {name} |

**Notes from dry run**: {e.g., "Step 2 took 3x longer than estimated with production-scale data. Revised estimate from 10 min to 30 min."}

## 6. Data Migration (if applicable)

| Data | Source | Destination | Method | Estimated Duration |
|------|--------|------------|--------|-------------------|
| {e.g., Embeddings} | {Qdrant 1.7 collection} | {Qdrant 1.12 collection} | {Re-index script} | {~2 hours for 100K docs} |

### Data Validation Queries

```sql
-- Verify row counts match
SELECT COUNT(*) FROM {table};

-- Verify no data corruption
SELECT * FROM {table} WHERE {integrity_check} LIMIT 10;
```

## 7. Rollback Procedure

### Decision Authority

| Role | Authority |
|------|-----------|
| **Can call rollback** | {e.g., On-call engineer, SRE, migration executor} |
| **Must be notified** | {e.g., Engineering manager, service owner} |
| **Must approve re-attempt** | {e.g., Tech lead + SRE} |

### Trigger Conditions

Rollback if any of:
- {e.g., "Migration script fails at any step"}
- {e.g., "Post-migration health checks fail"}
- {e.g., "Error rate exceeds 1% in first 30 minutes"}

### Rollback Steps

#### Step 1: {Description}

```bash
{command}
```

#### Step 2: {Description}

```bash
{command}
```

### Rollback Verification

```bash
# Confirm system is back to pre-migration state
{verification command}
```

## 8. Post-Migration Verification

| Check | Command / Query | Expected Result |
|-------|----------------|-----------------|
| {Service health} | `{command}` | {e.g., "200 OK from /health"} |
| {Data integrity} | `{query}` | {e.g., "Row count matches pre-migration"} |
| {Feature test} | {e.g., "Upload and process a contract"} | {e.g., "Extraction completes successfully"} |

## 9. Downtime Estimate

| Component | Downtime | Mitigation |
|-----------|----------|------------|
| {e.g., Database} | {e.g., ~5 min for PG restart} | {e.g., "Run during maintenance window"} |
| {e.g., Search} | {e.g., ~2 hours for re-index} | {e.g., "Old index remains queryable during re-index"} |

## 10. Feature Flag Coordination

> If the migration requires feature flags to be toggled in a specific order relative to schema/data changes, document the sequence here. Mark `N/A` if no feature flags are involved.

| Step | Flag / Action | State | Must Complete Before |
|------|---------------|-------|---------------------|
| {1} | {e.g., `ENABLE_NEW_SCHEMA`} | {OFF → ON} | {Step 3 of migration} |
| {2} | {e.g., Run data backfill} | {N/A} | {Enabling read path} |
| {3} | {e.g., `USE_NEW_READ_PATH`} | {OFF → ON} | {Disabling old write path} |
| {4} | {e.g., `DISABLE_OLD_WRITE_PATH`} | {ON → OFF} | {Cleanup} |

## 11. Communication Plan

| When | Who | Message |
|------|-----|---------|
| {Before migration} | {Engineering team} | {Migration starting at X, expected downtime Y} |
| {After migration} | {All stakeholders} | {Migration complete, verification results} |
| {If rollback} | {All stakeholders} | {Rollback initiated, reason, ETA for retry} |

## 12. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Runbook | [Runbook](../phase-{X}/{X.X}_runbook_{name}.md) |
| ADR | [ADR](../phase-{X}/{X.X}_adr_{name}.md) |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial draft | {name} |
| {YYYY-MM-DD} | {e.g., Updated rollback procedure after staging test} | {name} |
| {YYYY-MM-DD} | {e.g., Approved for production} | {name} |
