---
name: write-dep-review
description: Guide through creating a Dependency Review with license audit, supply chain health, security scan, breaking changes, and maintenance plan
---

# Write a Dependency Review

You are helping the user create a Dependency Review. The Dep Review answers: **"Is this dependency safe to adopt?"** Required before adding new dependencies or major version bumps.

## Before You Start

1. Read the template: `docs/templates/DEP_REVIEW_TEMPLATE.md`
2. Determine the review depth:
   - **Quick**: Patch bump, no breaking changes → fill sections 1-4 and 10
   - **Standard**: Minor bump → fill most sections
   - **Deep**: New dependency or major bump → fill everything

## Authorship

- **Primary author**: Engineer introducing the dependency
- **Co-contributors**: Security Engineer (audit), Tech Lead
- **Approvers**: Tech Lead
- **Consumers**: Security team, all engineers (maintenance plan), SRE (runtime impact)

## Naming

```
docs/phase-{N}/{N.X}_dep-review_{package-name}.md
```

Bundle multiple deps when they share context: `docs/phase-2/2.1_dep-review_python-upgrades.md`

## Workflow

### 1. Motivation
Why is this dependency being added/upgraded? What problem does it solve?

### 2. Dependencies Under Review
Table: package, current version, target version, ecosystem.
Document version pinning strategy for each lockfile.

### 3. License Audit
Check every package's license. Flag SSPL, AGPL, or non-OSI-approved licenses.

### 4. Security Audit
- Check CVEs (pip-audit, npm audit, GitHub Advisory Database)
- Assess supply chain health: maintainer count, bus factor, funding, ownership transfers
- Run OpenSSF Scorecard
- Check for typosquatting
- Verify package signing/provenance

### 5. Breaking Changes
For each breaking change: what it is, how many files are affected, what fix is needed.

### 6. Transitive Dependencies
List NEW transitive deps introduced. Check licenses and size impact.
Assess runtime impact: cold start, memory overhead.

### 7. Maintenance Plan
Define: update strategy, update owner, breaking change policy, deprecation monitoring, fallback if abandoned.

### 8-10. Alternatives, Rollback, Decision
Alternatives only for new deps (skip for bumps). Rollback command. Approval decision.

## Quality Checklist

- [ ] License is compatible with project
- [ ] pip-audit / npm audit shows no unresolved CVEs
- [ ] Supply chain health assessed (maintainer count, bus factor)
- [ ] Breaking changes identified with fix plan
- [ ] Transitive deps reviewed for license and size
- [ ] Maintenance plan defines who owns future updates
- [ ] Fallback plan exists if dependency is abandoned
- [ ] Rollback command is documented and tested
