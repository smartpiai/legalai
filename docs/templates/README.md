# Document Templates

Use these templates for all roadmap documentation. Pick the right template based on the [Document Matrix](../../DOCUMENT_MATRIX.md).

## Quick Reference: Which Template?

| Question You're Answering | Template |
|---------------------------|----------|
| Why are we doing this work? | [BRD](BRD_TEMPLATE.md) |
| What should the user experience? | [PRD](PRD_TEMPLATE.md) |
| Which option did we pick and why? | [ADR](ADR_TEMPLATE.md) |
| How does the implementation work? | [Tech Spec](TECH_SPEC_TEMPLATE.md) |
| How do we test it? | [Test Spec](TEST_SPEC_TEMPLATE.md) |
| What does the API contract look like? | [ID Spec](ID_SPEC_TEMPLATE.md) |
| How do we migrate data/schemas? | [Migration Guide](MIG_GUIDE_TEMPLATE.md) |
| How do we deploy and operate it? | [Runbook](RUNBOOK_TEMPLATE.md) |
| What are the security implications? | [Security Review](SEC_REVIEW_TEMPLATE.md) |
| Is this dependency safe to adopt? | [Dependency Review](DEP_REVIEW_TEMPLATE.md) |
| What are the performance requirements? | [Performance Spec](PERF_SPEC_TEMPLATE.md) |

## When NOT to Write a Document

Not every change needs a formal document. Use your judgment:

| Change Size | Documentation |
|------------|---------------|
| One-liner bug fix | PR description is sufficient |
| Config change | PR description + inline comment in config |
| Small refactor (< 100 lines, no behavior change) | PR description explaining the "why" |
| Dependency patch bump (no breaking changes) | PR description; no Dep Review needed |
| Internal-only API change (no external consumers) | PR description; ID Spec update only if one already exists |

**Rule of thumb**: If a future engineer would need to understand *why* this decision was made (not just *what* changed), write a document. If the PR description is enough, skip the template.

## Typical Document Flow

For a new feature, documents are typically created in this order:

```
BRD → PRD → ADR (if decision needed) → Tech Spec → ID Spec (if API) → Test Spec
                                                  → Perf Spec (if perf-sensitive)
                                                  → Security Review (if security-sensitive)
                                                  → Migration Guide (if data changes)
                                                  → Runbook (for new services)
                                                  → Dep Review (for new dependencies)
```

Not every feature needs every document. Use the Document Weight guidance below and the [Document Matrix](../../DOCUMENT_MATRIX.md) to decide.

## Naming Convention

```
docs/{phase}/{phase-sub-number}_{doc-type}_{short-name}.md
```

The number prefix is the **phase sub-number** from the roadmap (e.g., `0.2.2`, `3.1.3`), NOT a PR number. This keeps documents stable across PR rebases and squash merges.

Examples:
```
docs/phase-0/0.2.2_sec-review_cve-audit.md
docs/phase-1/1.2.1_tech-spec_pgvector-schema.md
docs/phase-3/3.1.3_id-spec_tool-interface.md
docs/phase-3/3.3_tech-spec_specialized-agents.md    (bundled across 3.3.1-3.3.5)
```

## Bundling Rules

Not every PR needs its own document. Bundle when items share context:

- All dep bumps in a sub-phase share one **Dep Review** (e.g., `2.1_dep-review_python-upgrades.md`)
- All tools in 3.2 share one **Tool Library ID Spec** (e.g., `3.2_id-spec_tool-library.md`)
- All route migrations in 4.4 share one **Test Spec** (e.g., `4.4_test-spec_routing-migration.md`)

## Document Weight

Scale depth to PR size:

| PR Size | Doc Expectation |
|---------|-----------------|
| **S** | PR description covers it, or a single-section markdown |
| **M** | Fill the template but skip sections that don't apply |
| **L** | Full template, diagrams, sequence flows |

Mark skipped sections with `N/A — [reason]` rather than deleting them. Sections serve as a checklist even when not applicable.

## Cross-Linking Convention

All templates use a consistent cross-linking pattern via a **Related Documents** table. Use relative paths:

```markdown
| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
```

Every document should link to its upstream (what motivated it) and downstream (what implements it) documents.

## Version History

Every template includes a **Version History** table at the bottom. Update it when:
- The document is created (Initial draft)
- The status changes (Draft → In Review → Approved)
- Significant content changes are made post-approval

## Review Process

| Doc Type | Primary Reviewer | Approval Required? |
|----------|-----------------|-------------------|
| BRD | Product Owner + Engineering Manager | Yes — before work starts |
| PRD | Product Owner + Tech Lead | Yes — before Tech Spec |
| ADR | Tech Lead + affected team leads | Yes — before implementation |
| Tech Spec | Tech Lead + peer engineers | Yes — before coding starts |
| ID Spec | Tech Lead + API consumers | Yes — before implementation |
| Test Spec | QA Lead + Tech Lead | Yes — before merge |
| Perf Spec | Tech Lead + SRE | Yes — baselines required before approval |
| Security Review | Security Reviewer + Tech Lead | Yes — before merge (for High/Critical) |
| Dep Review | Tech Lead | Yes — before merge |
| Migration Guide | SRE + Tech Lead | Yes — before execution |
| Runbook | SRE + Service Owner | Yes — before go-live |

### Small Team Role Mapping

> If your team is < 5 people, one person may fill multiple roles. Use this mapping:

| Role in Templates | Small Team Equivalent |
|-------------------|----------------------|
| Product Owner | Founder / tech lead wearing product hat |
| Tech Lead | Senior engineer / architect |
| SRE | Whoever manages infrastructure and deploys |
| QA Lead | Engineer who owns the test suite |
| Security Reviewer | Tech lead (or external consultant for High/Critical) |
| Engineering Manager | Tech lead or founder |

## Contributing to Templates

These templates are living documents. To propose changes:

1. Open a PR modifying the template file(s) in `docs/templates/`
2. Include a rationale for why the change improves the template
3. Update the README if adding/removing/renaming a template
4. Get approval from the Tech Lead
