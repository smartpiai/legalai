---
name: write-runbook
description: Guide through creating an Operational Runbook with quick reference card, symptom-based troubleshooting, escalation paths, and incident history
---

# Write an Operational Runbook

You are helping the user create a Runbook. The Runbook answers: **"How do we deploy and operate this?"** It should be optimized for the person reading it at 3am during an incident.

## Before You Start

1. Read the template: `docs/templates/RUNBOOK_TEMPLATE.md`
2. Check for the upstream Tech Spec and Migration Guide
3. This document must be validated via dry-run before go-live

## Authorship

- **Primary author**: SRE / Service Owner
- **Co-contributors**: On-call engineers with incident history
- **Approvers**: SRE + Service Owner
- **Consumers**: On-call engineer (L1/L2), new team members, adjacent service owners

## Naming

```
docs/phase-{N}/{N.X}_runbook_{service-name}.md
```

## Workflow

### 0. Quick Reference Card (MOST IMPORTANT)
Ask: "What are the 5 commands someone needs at 3am?"
- Check health, view errors, restart, scale up, rollback
- Include escalation pointer

### 1. Service Overview
Dependencies (Required vs Degraded), ports/endpoints, health check schema.

### 2. Deployment
Pre-deployment checklist, deploy commands, post-deployment verification.

### 3. Monitoring
Key metrics with normal ranges, alert thresholds, and dashboard links.
Log locations and key log queries.

### 4. Known Limits
For each resource: hard limit, symptom when exceeded, action to take.

### 5. Troubleshooting
**Start with the Symptom-Based Lookup Table** — this is what the on-call engineer sees first.
Then detail each issue: severity, symptoms, root cause, diagnosis commands, resolution commands, prevention.

### 6. Escalation Path
Tier-based: L1 (15 min) → L2 (30 min) → L3 (60 min) → L4 (as needed).
Include contact info and timezone.

### 7-12. Remaining Sections
Complete: Scaling, Backup & Recovery, Routine Maintenance, Past Incidents, Contacts, Related Documents.

## Quality Checklist

- [ ] Quick Reference Card has 5 working commands
- [ ] Every command in the runbook is copy-pasteable (not pseudocode)
- [ ] Symptom-Based Lookup Table covers the most common failure modes
- [ ] Escalation path has names, contacts, and timezones
- [ ] Known Limits section includes every resource with a hard ceiling
- [ ] Routine Maintenance has frequency and "Last Performed" dates
- [ ] Past Incidents section links to postmortems
- [ ] Runbook Exercise Log records when this was last tested
