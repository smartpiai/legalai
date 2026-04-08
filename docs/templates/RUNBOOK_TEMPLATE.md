# Operational Runbook

> **Service/Component**: {name}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Last Tested**: {YYYY-MM-DD}
> **Last Reviewed**: {YYYY-MM-DD}

---

## 0. Quick Reference Card

> The 5 commands you need at 3am. Read the full runbook later.

| Action | Command |
|--------|---------|
| Check health | `curl -s http://localhost:8000/health \| jq .` |
| View recent errors | `{log query for errors in last 15 min}` |
| Restart service | `{restart command}` |
| Scale up | `{scale command}` |
| Rollback to last good deploy | `{rollback command}` |

**Escalation**: If unresolved in 15 min, page L2 — see [Section 5](#5-escalation-path).

---

## 1. Service Overview

{What does this service/component do? What depends on it?}

### Dependencies

| Dependency | Type | Impact if Unavailable |
|------------|------|----------------------|
| {e.g., PostgreSQL} | Required | {Service cannot start} |
| {e.g., Anthropic API} | Required | {Agent calls fail, returns error} |
| {e.g., Redis} | Degraded | {No caching, slower but functional} |

### Ports & Endpoints

| Endpoint | Port | Purpose |
|----------|------|---------|
| {e.g., /health} | {8000} | {Health check} |
| {e.g., /metrics} | {8000} | {Prometheus metrics} |

### Health Check Definition

The `/health` endpoint returns the following schema:

```json
{
  "status": "healthy | degraded | unhealthy",
  "version": "1.2.3",
  "uptime_seconds": 86400,
  "checks": {
    "database": { "status": "up | down", "latency_ms": 12 },
    "cache": { "status": "up | down", "latency_ms": 3 },
    "external_api": { "status": "up | down", "latency_ms": 150 }
  }
}
```

**Status determination rules:**

| Condition | `status` Value | HTTP Code |
|-----------|---------------|-----------|
| All checks `up` | `healthy` | 200 |
| Any non-required check `down` (e.g., cache) | `degraded` | 200 |
| Any required check `down` (e.g., database) | `unhealthy` | 503 |
| Health endpoint itself unreachable | N/A (timeout) | N/A |

## 2. Deployment

### Pre-Deployment Checklist

- [ ] All tests passing in CI
- [ ] Migration guide reviewed (if schema changes)
- [ ] Feature flags configured
- [ ] Monitoring dashboards open

### Deploy Steps

```bash
# Step 1: {Description}
{command}

# Step 2: {Description}
{command}
```

### Post-Deployment Verification

```bash
# Health check
curl -s http://localhost:8000/health | jq .

# Smoke test
{command}
```

## 3. Monitoring

### Key Metrics

| Metric | Normal Range | Alert Threshold | Dashboard |
|--------|-------------|-----------------|-----------|
| {e.g., Request latency p95} | {< 500ms} | {> 2s for 5 min} | {Grafana: API Latency} |
| {e.g., Error rate} | {< 0.1%} | {> 1% for 5 min} | {Grafana: Error Rate} |
| {e.g., Agent token cost/hr} | {< $10/hr} | {> $50/hr} | {Custom dashboard} |

### Log Locations

| Component | Location | Format |
|-----------|----------|--------|
| {Backend} | {stdout / /var/log/app.log} | {Structured JSON} |
| {Celery/Temporal} | {stdout} | {Structured JSON} |

### Key Log Queries

```bash
# Find agent errors in last hour
{log query command}

# Find slow requests
{log query command}
```

## 4. Known Limits

| Resource | Hard Limit | Symptom When Exceeded | Action |
|----------|-----------|----------------------|--------|
| {e.g., Database connections} | {e.g., 200} | {e.g., "connection refused" errors, 503s} | {e.g., Restart connection pooler, investigate leaked connections} |
| {e.g., Disk space (data volume)} | {e.g., 100GB} | {e.g., Writes fail, database crashes} | {e.g., Expand volume, run VACUUM FULL, archive old data} |
| {e.g., Memory per container} | {e.g., 4GB} | {e.g., OOMKilled, pod restart loop} | {e.g., Increase memory limit, investigate memory leak} |
| {e.g., Max concurrent agent sessions} | {e.g., 50} | {e.g., Queued requests, timeouts} | {e.g., Scale replicas, implement request shedding} |
| {e.g., API rate limit (external)} | {e.g., Anthropic: 1000 RPM} | {e.g., 429 responses from upstream} | {e.g., Queue and retry with backoff, alert if sustained} |

## 5. Common Issues & Troubleshooting

### Severity Classification

| Priority | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| **P0 — Critical** | Service down or data loss occurring. Page immediately. | Immediate (< 5 min) | Complete outage, data corruption, security breach |
| **P1 — High** | Service degraded or major feature broken. | Within 1 hour | Elevated error rates, partial outage, broken critical workflow |
| **P2 — Medium** | Minor issue, workaround available. | Next business day | Slow non-critical path, cosmetic errors, noisy logs |

### Symptom-Based Lookup

> Start here when you're paged. Find the symptom, follow the resolution.

| Symptom | Likely Cause | Resolution | Severity |
|---------|-------------|------------|----------|
| {e.g., `/health` returns 503} | {e.g., Database down} | {See Issue 1 below} | P0 |
| {e.g., Elevated p95 latency (>5s)} | {e.g., Missing index or full table scan} | {See Issue 2 below} | P1 |
| {e.g., Agent calls returning empty results} | {e.g., Qdrant collection not loaded} | {See Issue 3 below} | P1 |
| {e.g., Spike in 429 responses} | {e.g., Upstream rate limit hit} | {See Issue 4 below} | P2 |

---

### Issue 1: {Description}

**Severity**: {P0 / P1 / P2}

**Symptoms**: {What you observe — logs, metrics, user reports}

**Root Cause**: {What causes it}

**Diagnosis**:
```bash
# Commands to confirm this is the issue
{diagnostic command}
```

**Resolution**:
```bash
{fix command}
```

**Prevention**: {How to prevent recurrence}

---

### Issue 2: {Description}

**Severity**: {P0 / P1 / P2}

**Symptoms**: {What you observe}

**Root Cause**: {What causes it}

**Diagnosis**:
```bash
{diagnostic command}
```

**Resolution**:
```bash
{fix command}
```

**Prevention**: {How to prevent recurrence}

---

## 6. Escalation Path

| Step | Tier | Timeout Before Escalation | Role | Contact |
|------|------|--------------------------|------|---------|
| 1 | L1 — Initial Responder | 15 minutes | On-call engineer | {pager / Slack: #oncall-{service}} |
| 2 | L2 — Senior Engineer | 30 minutes | Service owner / senior SRE | {name, phone, Slack handle} |
| 3 | L3 — Engineering Manager | 60 minutes | Engineering manager | {name, phone, Slack handle} |
| 4 | L4 — Executive | As needed | VP Engineering / CTO | {name, phone} |

**Escalation rules:**
- **P0**: Start at L1. If unresolved after timeout, auto-escalate to next tier. Notify L3 immediately in parallel.
- **P1**: Start at L1. Escalate to L2 after 15 min if no progress. L3 notified after 1 hour.
- **P2**: L1 owns resolution. Escalate to L2 only if blocked.

## 7. Scaling

### Horizontal Scaling

```bash
# Scale backend replicas
{command}
```

**Considerations**: {e.g., "Session affinity required for WebSocket connections"}

### Vertical Scaling

| Resource | Current | When to Increase | Target |
|----------|---------|------------------|--------|
| {CPU} | {2 cores} | {Sustained > 80%} | {4 cores} |
| {Memory} | {4GB} | {Sustained > 80%} | {8GB} |

## 8. Backup & Recovery

| Data | Backup Method | Frequency | Retention | Recovery Time |
|------|--------------|-----------|-----------|---------------|
| {PostgreSQL} | {pg_dump} | {Daily} | {30 days} | {~30 min} |
| {Qdrant collections} | {Snapshot API} | {Weekly} | {4 weeks} | {~2 hours} |

### Recovery Procedure

```bash
# Restore from backup
{command}
```

## 9. Routine Maintenance

| Task | Frequency | Procedure | Est. Duration | Last Performed |
|------|-----------|-----------|---------------|----------------|
| PostgreSQL VACUUM ANALYZE | Weekly (Sunday 02:00 UTC) | `vacuumdb --analyze --all` | ~15 min | {YYYY-MM-DD} |
| Reindex search indices | Monthly (1st Sunday 03:00 UTC) | `REINDEX DATABASE {dbname};` | ~30 min | {YYYY-MM-DD} |
| TLS certificate rotation | 60 days before expiry | See cert rotation playbook | ~10 min | {YYYY-MM-DD} |
| Log rotation | Daily | Managed by logrotate; verify with `logrotate --debug /etc/logrotate.d/{service}` | Automatic | N/A |
| Dependency security patches | Monthly | Review via `pip-audit` / `npm audit` and apply | ~1 hour | {YYYY-MM-DD} |
| Backup verification | Monthly | Restore latest backup to staging and run smoke tests | ~1 hour | {YYYY-MM-DD} |

## 10. Past Incidents

> Link to postmortems that informed this runbook's procedures. Keeps institutional knowledge alive.

| Date | Incident | Severity | Postmortem | What Changed in This Runbook |
|------|----------|----------|------------|------------------------------|
| {YYYY-MM-DD} | {e.g., Database connection exhaustion during peak load} | P0 | [{Postmortem link}]({URL}) | {e.g., Added connection pool monitoring to Section 3; added Issue 1 to Section 5} |
| {YYYY-MM-DD} | {e.g., Agent cost spike due to retry loop} | P1 | [{Postmortem link}]({URL}) | {e.g., Added cost alert to Section 3; added token budget limit to Known Limits} |

### Runbook Exercise Log

> Record when this runbook was last tested via tabletop exercise or game day.

| Date | Exercise Type | Participants | Issues Found | Fixes Applied |
|------|--------------|-------------|--------------|---------------|
| {YYYY-MM-DD} | {Tabletop / Game day / Real incident} | {names} | {e.g., Rollback command was outdated} | {e.g., Updated Section 0 rollback command} |

## 11. Contacts

### Primary Contacts

| Role | Name | Contact | Timezone | Secondary |
|------|------|---------|----------|-----------|
| {Service Owner} | {name} | {email / Slack / phone} | {e.g., US-East / UTC-5} | {backup name, contact} |
| {On-Call L1} | {rotation} | {pager / Slack: #oncall-{service}} | {24x7 follow-the-sun} | {backup rotation} |
| {On-Call L2} | {name} | {phone / Slack handle} | {e.g., US-West / UTC-8} | {backup name, contact} |
| {Engineering Manager} | {name} | {email / phone} | {timezone} | {backup name, contact} |

### Timezone Coverage

| Coverage Window | Primary Region | On-Call Team |
|----------------|---------------|--------------|
| 00:00 — 08:00 UTC | {APAC} | {team/rotation} |
| 08:00 — 16:00 UTC | {EMEA} | {team/rotation} |
| 16:00 — 00:00 UTC | {Americas} | {team/rotation} |

### External Vendor Contacts

| Vendor | Support Tier | Contact | SLA |
|--------|-------------|---------|-----|
| {e.g., Cloud Provider} | {Enterprise} | {support portal / phone} | {1 hour response} |
| {e.g., Anthropic API} | {Standard} | {support email} | {4 hour response} |

## 12. Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Migration Guide | [Migration Guide](../phase-{X}/{X.X}_mig-guide_{name}.md) |
| ADR | [ADR](../phase-{X}/{X.X}_adr_{name}.md) |
| Monitoring Dashboard | {Grafana URL} |
| Incident Response Playbook | [{Title}]({path}) |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial runbook creation | {name} |
| {YYYY-MM-DD} | {e.g., Added scaling procedures} | {name} |
| {YYYY-MM-DD} | {e.g., Updated escalation contacts} | {name} |
