# Legal AI Platform — Organizational Context

You are operating inside a Legal AI Platform codebase. This section provides organizational structure, document governance, agent architecture, and role-based guidance.

## Agent Architecture

This project uses a **who + what** agent model:

- **Role agents** (`.pi/agents/roles/`): Organizational personas with role-specific knowledge, language, and tool access. Each knows what documents they author, review, and consume.
- **Task agents** (`.pi/agents/tasks/`): Capability-focused agents with restricted tool access (read-only scout, write-only doc-writer, security-auditor with bash for scanning).
- **Teams** (`.pi/agents/teams.yaml`): Named groups of agents that run in parallel for multi-perspective analysis.
- **Chains** (`.pi/agents/chains.yaml`): Sequential pipelines where each agent's output feeds the next (scout → author → reviewer).
- **Skills** (`.pi/skills/`): Document authoring workflows that guide any agent through creating a specific document type.
- **Safety rules** (`.pi/safety-rules.yaml`): System protection (dangerous commands, untouchable files) and process protection (gate enforcement via extensions).

### When to Use What

| Situation | Use |
|-----------|-----|
| "I need to write a BRD" | Role agent `pm` + skill `write-brd`, or chain `create-brd` |
| "Review all docs for Phase 3" | Chain `review-phase` (scout → doc-reviewer → gate-checker) |
| "Is Phase 1 ready to deploy?" | Team `doc-review` or chain `plan-phase-docs` |
| "Check this code for security issues" | Task agent `security-auditor` or chain `security-pipeline` |
| "I just need help with Python code" | Default agent (no persona needed) |

### Tool Access by Agent Type

| Agent | read | write | edit | bash | grep | find | ls | doc tools |
|-------|------|-------|------|------|------|------|-----|-----------|
| **pm** | x | x | x | | x | x | x | status, gate |
| **tech-lead** | x | x | x | x | x | x | x | all |
| **engineer** | x | x | x | x | x | x | x | status, validate |
| **sre** | x | x | x | x | x | x | x | all |
| **security** | x | x | x | x | x | x | x | status, validate |
| **scout** | x | | | | x | x | x | all |
| **doc-writer** | x | x | x | | x | x | x | status, validate |
| **doc-reviewer** | x | | | | x | x | x | all |
| **gate-checker** | x | | | | x | x | x | all |
| **security-auditor** | x | | | x | x | x | x | |

## Organizational Roles

This project has the following roles. When assisting, tailor your depth, language, and focus to the role you are helping.

| Role | What They Care About | How to Help Them |
|------|---------------------|------------------|
| **Product Owner / PM** | Business justification, user impact, metrics, timelines | Speak in outcomes, not implementation. Help quantify ROI. Draft BRDs and PRDs. |
| **Tech Lead / Architect** | System design, trade-offs, dependency risks, code quality | Be precise about trade-offs. Surface edge cases. Help write ADRs and Tech Specs. |
| **Senior Engineer** | Component design, implementation patterns, test strategy | Provide concrete code patterns. Respect existing conventions. Help write Tech Specs and Test Specs. |
| **Engineer** | Implementation guidance, debugging, test writing | Be specific. Show code. Explain the "why" behind patterns. Reference relevant specs. |
| **Frontend Engineer** | UI components, state management, accessibility, bundle size | Focus on React/TypeScript patterns, Tailwind conventions, client-side performance. |
| **SRE / Platform Engineer** | Infrastructure, deployment, monitoring, incident response | Provide operational commands, alert thresholds, rollback procedures. Help write Runbooks and Migration Guides. |
| **Security Engineer** | Threat models, attack surfaces, compliance, data handling | Think adversarially. Reference OWASP. Help write Security Reviews with proper risk scoring. |
| **QA Lead** | Test coverage, edge cases, CI pipeline, flaky tests | Focus on test strategy, fixture design, and coverage gaps. Help write Test Specs. |
| **Data / ML Engineer** | Model accuracy, eval harnesses, embedding pipelines, cost | Focus on accuracy metrics, cost projections, and eval methodology. Help write Perf Specs. |

When you cannot determine the user's role from context, ask: "What role are you working in right now? (PM, engineer, SRE, security, etc.)"

## Document Types and Their Purpose

This project uses 11 document types. Each has a template in `docs/templates/`.

| Type | Template | Purpose | Primary Author | Gate It Controls |
|------|----------|---------|----------------|-----------------|
| BRD | `docs/templates/BRD_TEMPLATE.md` | Business justification | Product Owner | Phase kickoff |
| PRD | `docs/templates/PRD_TEMPLATE.md` | User-facing requirements | Product Owner | Before Tech Spec |
| ADR | `docs/templates/ADR_TEMPLATE.md` | Architecture decisions | Tech Lead | Before implementation |
| Tech Spec | `docs/templates/TECH_SPEC_TEMPLATE.md` | Implementation design | Senior Engineer | Before coding |
| Test Spec | `docs/templates/TEST_SPEC_TEMPLATE.md` | Test strategy and cases | QA Lead / Engineer | Before merge |
| ID Spec | `docs/templates/ID_SPEC_TEMPLATE.md` | API contracts | Backend Engineer | Before implementation |
| Mig Guide | `docs/templates/MIG_GUIDE_TEMPLATE.md` | Migration procedures | SRE | Before deployment |
| Runbook | `docs/templates/RUNBOOK_TEMPLATE.md` | Operational procedures | SRE | Before go-live |
| Sec Review | `docs/templates/SEC_REVIEW_TEMPLATE.md` | Security analysis | Security Engineer | Before merge |
| Dep Review | `docs/templates/DEP_REVIEW_TEMPLATE.md` | Dependency evaluation | Engineer | Before merge |
| Perf Spec | `docs/templates/PERF_SPEC_TEMPLATE.md` | Performance requirements | SRE / Perf Engineer | Before perf-sensitive changes |

## Document Dependency Chain

Documents have upstream dependencies. A downstream document should not be written until its upstream dependency exists.

```
BRD (why) → PRD (what) → ADR (which option) → Tech Spec (how)
                                                    ↓
                              ┌────┬────┬────┬────┬─┴──┐
                              ↓    ↓    ↓    ↓    ↓    ↓
                            ID   Test  Perf  Sec  Dep  Mig
                            Spec Spec  Spec  Rev  Rev  Guide
                                                        ↓
                                                     Runbook
```

Before helping create a document, check whether its upstream dependencies exist. If they don't, warn the user and suggest creating the upstream document first.

## Document Naming Convention

All documents follow this pattern:
```
docs/{phase}/{phase-sub-number}_{doc-type}_{short-name}.md
```

Examples:
```
docs/phase-0/0.2.2_sec-review_cve-audit.md
docs/phase-1/1.2.1_tech-spec_pgvector-schema.md
docs/phase-3/3.1.3_id-spec_tool-interface.md
```

The number prefix is the roadmap sub-number, NOT a PR number.

## Approval Gates

Work cannot proceed past these gates without the relevant document approved:

| Gate | Required Document | Approver |
|------|-------------------|----------|
| Phase kickoff | BRD | CTO / VP Eng + Eng Manager |
| Requirements lock | PRD | Product Owner + Tech Lead |
| Design approval | ADR + Tech Spec | Tech Lead + peer engineers |
| Pre-implementation | ID Spec + Dep Review | Tech Lead + API consumers |
| Pre-merge | Test Spec + Sec Review | QA Lead / Security Reviewer |
| Pre-deployment | Mig Guide + Runbook + Perf Spec | SRE + Tech Lead |

## Document Matrix Reference

The full mapping of every roadmap item to required documents is in `DOCUMENT_MATRIX.md`. Consult it when asked what documents are needed for a specific PR or phase.

## Available Skills

This project provides document authoring skills. When a user wants to create a document, use the appropriate skill:

- `/skill:write-brd` — Guide through Business Requirements Document creation
- `/skill:write-prd` — Guide through Product Requirements Document creation
- `/skill:write-adr` — Guide through Architecture Decision Record creation
- `/skill:write-tech-spec` — Guide through Technical Specification creation
- `/skill:write-test-spec` — Guide through Test Specification creation
- `/skill:write-id-spec` — Guide through Interface Design Specification creation
- `/skill:write-mig-guide` — Guide through Migration Guide creation
- `/skill:write-runbook` — Guide through Operational Runbook creation
- `/skill:write-sec-review` — Guide through Security Review creation
- `/skill:write-dep-review` — Guide through Dependency Review creation
- `/skill:write-perf-spec` — Guide through Performance Specification creation
- `/skill:review-doc` — Review a document against its template for completeness
- `/skill:doc-status` — Report on document inventory and completeness by phase

## Key Project References

- Org structure and info flow: `docs/ORG_DOC_FLOW.md`
- Document matrix: `DOCUMENT_MATRIX.md`
- Modernization roadmap: `MODERNIZATION_ROADMAP.md`
- Templates: `docs/templates/`
- Template usage guide: `docs/templates/README.md`

## Template Compliance (MANDATORY)

Every document in `docs/` must be produced from the corresponding template in `docs/templates/`. This is not optional.

### Before Writing Any Document

1. **Read the template first.** Every time. Do not write from memory. Read `docs/templates/{TYPE}_TEMPLATE.md` for the exact structure.
2. **Preserve all sections.** The template's section numbers and headings are the canonical structure. Do not rename, reorder, merge, or remove sections.
3. **Mark unused sections N/A.** If a section doesn't apply, write `N/A — {reason}` rather than deleting it. The section headings serve as a checklist even when empty.
4. **Preserve all tables.** If a template section contains a table structure, the output must use that same table structure with the same columns.

### Template-to-Type Mapping

| Doc type in filename | Template file | Required header fields |
|---------------------|---------------|----------------------|
| `brd` | `BRD_TEMPLATE.md` | Phase, Author, Date, Status |
| `prd` | `PRD_TEMPLATE.md` | Feature, Phase, Author, Date, Status |
| `adr` | `ADR_TEMPLATE.md` | Date, Decision Date, Review By, Decision Owner, Status, Deciders |
| `tech-spec` | `TECH_SPEC_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status, Reviewers |
| `test-spec` | `TEST_SPEC_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status |
| `id-spec` | `ID_SPEC_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status, Version |
| `mig-guide` | `MIG_GUIDE_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status |
| `runbook` | `RUNBOOK_TEMPLATE.md` | Service/Component, Phase, PR(s), Author, Date, Last Tested, Last Reviewed |
| `sec-review` | `SEC_REVIEW_TEMPLATE.md` | Title, Phase, PR(s), Author, Reviewer, Date, Status, Risk Level |
| `dep-review` | `DEP_REVIEW_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status |
| `perf-spec` | `PERF_SPEC_TEMPLATE.md` | Title, Phase, PR(s), Author, Date, Status |

### Every Document Must Have

These sections exist in every template and must be present in every document:

- **Header block** with all fields from the template (use `>` blockquote format)
- **Related Documents** table linking upstream and downstream docs
- **Version History** table with at least one entry (initial draft)

### What Template Compliance Means in Practice

**Correct** — follows BRD_TEMPLATE.md section structure:
```
## 1. Executive Summary
## 2. Business Problem
## 3. Impact of Inaction
...
## 14. Approval
## Version History
```

**Incorrect** — invents its own structure:
```
## Overview
## Problem
## Solution
## Next Steps
```

The second example may contain useful information, but it doesn't adhere to the template. It cannot pass review.

## Sprint System

Sprints are time-boxed work packages that connect the MODERNIZATION_ROADMAP.md to executable tasks.

**Commands:**
- `/sprint status` — Show current sprint progress
- `/sprint plan <phases>` — Auto-plan a sprint from roadmap phases (e.g., `/sprint plan 0,1`)
- `/sprint execute` — Execute sprint backlog in dependency order via dispatch
- `/sprint close` — Close sprint and generate summary
- `/standup` — Daily standup: done, in progress, blocked
- `/retro` — Sprint retrospective with velocity analysis
- `/board` — Show sprint backlog as kanban board

**Tools:**
- `sprint_status` — Read current sprint state
- `sprint_update` — Update backlog item status (auto-unblocks dependents)
- `sprint_plan` — Auto-generate sprint from roadmap + document matrix

**State:** `.pi/state/sprints/sprint-{N}.yaml`

Sprint planning auto-generates backlog items from:
- Required documents per phase (from DOCUMENT_MATRIX.md)
- Existing document inventory (from `docs/`)
- Upstream dependencies (BRD → PRD → Tech Spec → ...)
- Role assignments (BRD → PM, Tech Spec → Tech Lead, etc.)

## Safety Enforcement

Safety rules in `.pi/safety-rules.yaml` are **enforced at runtime** by the `safety-enforcer` extension:

- **Bash patterns**: Dangerous commands (rm -rf, git push --force, DROP TABLE, etc.) trigger confirmation dialogs or hard blocks
- **Zero-access paths**: `.env`, secrets, SSH keys, cloud credentials — ALL operations blocked
- **Read-only paths**: Lock files, CI configs, `.git/` — reads allowed, writes blocked
- **No-delete paths**: LICENSE, CLAUDE.md, `.pi/`, templates — delete operations blocked

Negation patterns (`!**/.env.example`) whitelist specific paths from broader rules.

## Cross-Agent Discovery

The `cross-discovery` extension scans for agent definitions across tool directories:
- `.claude/agents/`, `.gemini/agents/`, `.codex/agents/` (project and global)
- Discovered agents become available as dispatch targets
- Use `list_agents` tool or `/agents` command to see all known agents

## TUI Dashboard

- **Footer**: Context meter, token in/out, cost, active role, git branch, tool counts
- **Dispatch widget**: Live progress when chains/teams are executing
- **Commands**: `/gates` (gate readiness), `/board` (sprint kanban)
- **Notifications**: Toast when chains complete, sprint items finish, gates change

## Behavioral Guidelines

1. **Read the template before writing.** Not negotiable. Read `docs/templates/{TYPE}_TEMPLATE.md` every time.
2. **Always check upstream documents** before helping create a downstream one. Warn if missing.
3. **Use the naming convention** when creating new documents. Never invent a new naming pattern.
4. **Reference the Document Matrix** when asked what docs are needed for a PR or phase.
5. **Tailor your language** to the user's role. Don't explain database internals to a PM. Don't explain business ROI to an engineer unless relevant.
6. **Cross-link documents** using the Related Documents table at the bottom of every template.
7. **Mark sections N/A** rather than deleting them when a section doesn't apply.
8. **Never fabricate document content**. If you don't have enough context to fill a section, leave it as a placeholder and tell the user what information is needed.
