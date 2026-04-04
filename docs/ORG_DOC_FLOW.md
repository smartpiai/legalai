# Organizational Structure, Document Ownership & Information Flow

**Created**: 2026-04-01
**Purpose**: Define who writes each document type, who consumes it, and how information flows between organizational roles during the documentation lifecycle.

---

## 1. Organizational Roles

### Leadership

| Role | Responsibility | Decision Authority |
|------|---------------|--------------------|
| **CTO / VP Engineering** | Technical vision, budget approval, escalation endpoint | Kill/go on phases, infrastructure budget, vendor contracts |
| **Engineering Manager** | Team capacity, sprint planning, hiring, cross-team coordination | Staffing allocation, timeline commitments, escalation decisions |
| **Product Owner / PM** | Product vision, feature prioritization, market alignment | Feature scope, release timing, user-facing trade-offs |

### Engineering

| Role | Responsibility | Decision Authority |
|------|---------------|--------------------|
| **Tech Lead / Architect** | System design, code quality, technical decisions | Architecture choices, dependency approval, spec sign-off |
| **Senior Engineer** | Feature design, implementation leadership, mentorship | Component-level design, tool/library selection within constraints |
| **Engineer** | Implementation, testing, code review | Implementation approach within approved spec |
| **Frontend Engineer** | UI/UX implementation, client-side performance, accessibility | Frontend architecture within approved patterns |

### Specialist

| Role | Responsibility | Decision Authority |
|------|---------------|--------------------|
| **SRE / Platform Engineer** | Infrastructure, deployment, monitoring, incident response | Deployment procedures, scaling decisions, alert thresholds |
| **Security Engineer / Reviewer** | Threat modeling, security audits, compliance verification | Security approval/block on merges, pen test scope |
| **QA Lead** | Test strategy, coverage standards, quality gates | Test pass/fail criteria, release readiness |
| **Data / ML Engineer** | AI model integration, eval harness, embedding pipelines | Model selection within cost constraints, accuracy thresholds |

### External Stakeholders

| Role | Responsibility | Interaction Point |
|------|---------------|-------------------|
| **Legal / Compliance** | Regulatory requirements, DPA review, data handling policies | Security Review (Sec Review), BRD approval for compliance-driven work |
| **Finance** | Budget approval, cost tracking | BRD cost estimates, Perf Spec cost projections |
| **Customer Success** | User feedback relay, onboarding requirements | PRD user stories, success metric validation |

### Small Team Role Collapse

> In teams under 5 people, individuals fill multiple roles. This mapping prevents role confusion.

| Functional Role | Small Team Equivalent |
|----------------|----------------------|
| Product Owner | Founder / Tech Lead wearing product hat |
| Tech Lead + Architect | Senior Engineer / founding engineer |
| SRE | Whoever manages infrastructure and deploys |
| QA Lead | Engineer who owns the test suite |
| Security Reviewer | Tech Lead (external consultant for High/Critical) |
| Engineering Manager | Tech Lead or founder |
| Data/ML Engineer | Backend engineer with ML experience |

---

## 2. Document Authorship & Consumption Matrix

### Who Writes, Who Reviews, Who Consumes

```
Author  ----writes---->  Document  ----reviewed by---->  Reviewer
                            |
                            +------consumed by-------->  Consumer
```

| Document | Primary Author | Co-Contributors | Reviewer / Approver | Primary Consumers | Secondary Consumers |
|----------|---------------|-----------------|--------------------|--------------------|---------------------|
| **BRD** | Product Owner | Eng Manager, Finance | CTO / VP Eng + Eng Manager | Engineering (scoping), Finance (budget) | Legal (compliance items), Customer Success |
| **PRD** | Product Owner | UX Designer, Tech Lead, Data/ML Engineer | Product Owner + Tech Lead | Engineering (implementers), QA, UX | Customer Success (onboarding), Marketing |
| **ADR** | Tech Lead or Senior Engineer | Engineers who participated in evaluation | Tech Lead + affected team leads | All engineers (present + future), new hires | Product Owner (constraint awareness) |
| **Tech Spec** | Senior Engineer assigned to feature | Peer engineers via review | Tech Lead + peer engineers | Implementing engineers, code reviewers | QA (test planning), SRE (ops sections) |
| **ID Spec** | Backend Engineer who owns the API | Frontend Engineer (as consumer-reviewer) | Tech Lead + API consumers | Frontend engineers, integration partners | QA (contract tests), DevRel / Docs |
| **Test Spec** | QA Lead or feature engineer | Feature engineer, SRE (fault injection) | QA Lead + Tech Lead | Engineers writing tests, CI maintainers | Tech Lead (coverage sign-off) |
| **Perf Spec** | SRE or Performance Engineer | Tech Lead, Backend + Frontend Engineers | Tech Lead + SRE | SRE (monitoring), Engineers (CI thresholds) | PM (cost projections), Finance (infra budget) |
| **Sec Review** | Security Engineer | Tech Lead, feature engineer | Security Reviewer + Tech Lead | Engineers (remediation), Compliance team | Legal (DPA/GDPR), Auditors (SOC 2), CISO |
| **Dep Review** | Engineer introducing the dependency | Security Engineer (audit), Tech Lead | Tech Lead | Security team, all engineers (maintenance) | SRE (runtime impact) |
| **Mig Guide** | SRE or Infrastructure Engineer | Backend Engineer, DBA | SRE + Tech Lead | Migration executor (SRE / on-call) | Eng Manager (downtime comms), Support |
| **Runbook** | SRE or Service Owner | On-call engineers with incident history | SRE + Service Owner | On-call engineer (L1/L2 responders) | New team members, adjacent service owners |

---

## 3. Information Flow Diagrams

### 3.1 Feature Lifecycle: Document Flow

The following diagram shows how documents flow through an organization during a typical feature lifecycle. Documents on the left are created first; each feeds into the next.

```
Phase: Planning
                                                  +--> Finance
                                                  |    (budget approval)
    Product Owner -----> BRD -----> CTO/VP Eng ---+
                          |                       |
                          |                       +--> Eng Manager
                          |                            (capacity planning)
                          v
    Product Owner -----> PRD -----> Tech Lead --------> Engineering
         + UX             |         (feasibility)       (requirements)
         + Data/ML        |
                          v
Phase: Design
                                                  +--> All Engineers
    Tech Lead ---------> ADR -----> Team Leads ---+    (context for future)
         + Senior Eng     |
                          v
    Senior Engineer ----> Tech Spec --> Peer Review --> Implementing Engineers
         |                   |                              |
         |                   +---> SRE (ops sections)       |
         |                   +---> QA (test planning)       |
         v                                                  v
    Backend Eng -------> ID Spec ----> Frontend Eng    Code Implementation
         |                   |         (API consumer)
         |                   v
         |              QA / Contract Tests
         v
Phase: Safety Gates (parallel with design)

    Security Eng ------> Sec Review --> Tech Lead ------> Engineers
         + Tech Lead          |         (approval gate)   (remediation)
                              +-------> Compliance / Legal
                              +-------> Auditors

    Engineer ----------> Dep Review --> Tech Lead ------> Security Team
         + Security Eng       |         (approval gate)
                              +-------> SRE (runtime impact)

Phase: Validation

    QA Lead -----------> Test Spec ---> Tech Lead ------> Engineers
         + Feature Eng        |         (coverage gate)   (write tests)
                              +-------> CI Maintainers

    SRE / Perf Eng ----> Perf Spec --> Tech Lead -------> SRE (monitoring)
         + Tech Lead          |                           Engineers (CI thresholds)
                              +-------> PM / Finance (cost projections)

Phase: Deployment

    SRE ---------------> Mig Guide --> Tech Lead -------> Migration Executor
         + Backend Eng        |         (approval)        (SRE / on-call)
                              +-------> Eng Manager (downtime comms)

    SRE / Service Owner -> Runbook --> SRE team --------> On-call L1/L2
                              |                           New team members
                              +-------> Adjacent service owners
```

### 3.2 Document Dependency Chain

Documents are not independent. Each one feeds information into downstream documents and draws context from upstream ones. Breaking this chain (e.g., writing a Tech Spec without an approved PRD) leads to scope drift and rework.

```
    BRD                     (Why are we doing this?)
     |
     v
    PRD                     (What should the user experience?)
     |
     +--------> ADR         (Which option did we pick?)
     |           |
     v           v
    Tech Spec  <-+          (How does the implementation work?)
     |
     +----+----+----+----+----+
     |    |    |    |    |    |
     v    v    v    v    v    v
   ID   Test  Perf  Sec  Dep  Mig
   Spec Spec  Spec  Rev  Rev  Guide
                                |
                                v
                             Runbook (How do we operate it?)
```

**Upstream = motivation.** Every document should be traceable to the BRD that justified the work.

**Downstream = implementation.** The Tech Spec is the pivot point: it consumes product requirements and produces engineering artifacts.

### 3.3 Review & Approval Gates

Documents serve as approval gates. Work cannot proceed past a gate until the relevant document is approved.

```
Gate 1: Phase Kickoff
  BRD approved by CTO/VP Eng + Eng Manager
  |
  v
Gate 2: Requirements Lock
  PRD approved by Product Owner + Tech Lead
  |
  v
Gate 3: Design Approval
  ADR approved by Tech Lead + team leads
  Tech Spec peer-reviewed by engineers
  |
  v
Gate 4: Pre-Implementation
  ID Spec approved by Tech Lead + API consumers
  Dep Review approved by Tech Lead
  |
  v
Gate 5: Pre-Merge (per PR)
  Test Spec: coverage meets target
  Sec Review: signed off (for security-sensitive PRs)
  |
  v
Gate 6: Pre-Deployment
  Mig Guide: tested in staging, dry-run documented
  Runbook: validated via dry-run
  Perf Spec: baselines recorded, regression thresholds in CI
  |
  v
Gate 7: Production
  Post-deployment verification (Runbook Section 8)
```

---

## 4. Information Flow Patterns

### 4.1 Top-Down: Strategy to Implementation

Business context flows downward through the document chain. Each layer adds technical specificity.

| Layer | Document | Information Added | Audience Shift |
|-------|----------|-------------------|---------------|
| **Strategic** | BRD | Business justification, ROI, cost | Executives, PM |
| **Product** | PRD | User stories, acceptance criteria, UX | PM, Engineering, Design |
| **Architectural** | ADR, Tech Spec | Design decisions, component design, data models | Engineering |
| **Contract** | ID Spec, Perf Spec | API schemas, latency budgets, rate limits | Implementing engineers, SRE |
| **Validation** | Test Spec, Sec Review | Test cases, threat models, compliance | QA, Security, Auditors |
| **Operational** | Mig Guide, Runbook | Deploy steps, rollback procedures, monitoring | SRE, On-call |

**Key principle**: Each layer translates the language of the layer above into language its audience understands. The BRD speaks in dollars and risk. The Runbook speaks in bash commands and alert thresholds.

### 4.2 Bottom-Up: Implementation Feedback to Strategy

Information also flows upward. Operational reality informs future planning.

```
Runbook (incident occurs)
  |
  +--> Perf Spec updated (new baselines, revised budgets)
  +--> Sec Review updated (new threat discovered)
  +--> Tech Spec updated (design flaw identified)
        |
        +--> ADR revisited (decision assumptions invalidated)
              |
              +--> PRD updated (feature behavior changed)
                    |
                    +--> BRD updated (cost model revised, timeline shifted)
```

**Triggers for bottom-up flow:**

| Event | Documents Affected | Action |
|-------|--------------------|--------|
| Production incident | Runbook (add to past incidents), Perf Spec (revise thresholds) | Immediate |
| Security vulnerability | Sec Review (add finding), Dep Review (if dependency CVE) | Within 24h |
| Performance regression | Perf Spec (revise baselines), Tech Spec (design change needed) | Within sprint |
| Assumption invalidated | ADR (trigger review-by), BRD (re-evaluate ROI) | Next planning cycle |
| Feature adoption below target | PRD (revise requirements), BRD (re-evaluate business case) | Next planning cycle |

### 4.3 Cross-Functional: Lateral Information Flow

Some information flows laterally between peers rather than up or down the hierarchy.

```
Frontend Eng <---- ID Spec ----> Backend Eng
     (consumer)                  (producer)

SRE <---- Runbook / Mig Guide ----> Feature Engineer
     (executor)                      (author)

Security Eng <---- Sec Review ----> Feature Engineer
     (reviewer)                      (implementer)

QA <---- Test Spec ----> Feature Engineer
     (test designer)      (test implementer)
```

**The ID Spec is the most critical lateral document.** It is the contract between backend and frontend. When this document is wrong or outdated, both teams build against incorrect assumptions and integration breaks at the end.

---

## 5. Document Lifecycle & Ownership

### 5.1 Lifecycle States

Every document follows the same state machine:

```
Draft --> In Review --> Approved --> [Active] --> Superseded / Deprecated
                          |                            ^
                          +--- Updated (minor) --------+
                          |
                          +--- Major Revision --> In Review (re-approval)
```

| State | Who Can Transition | What It Means |
|-------|-------------------|---------------|
| **Draft** | Author | Work in progress, not yet ready for review |
| **In Review** | Author (submits), Reviewer (reviews) | Under active review, comments being addressed |
| **Approved** | Reviewer / Approver | Cleared for downstream work to proceed |
| **Active** | Author (minor updates) | Living document, updated as implementation progresses |
| **Superseded** | Author of replacement document | Replaced by a newer version (link to successor) |
| **Deprecated** | Tech Lead / Eng Manager | No longer applicable, retained for historical context |

### 5.2 Ownership After Approval

Documents do not become orphans after approval. Each type has a long-term owner.

| Document | Long-Term Owner | Staleness Signal | Refresh Trigger |
|----------|----------------|-------------------|-----------------|
| BRD | Product Owner | Assumptions invalidated, ROI not tracking | Quarterly business review |
| PRD | Product Owner | Feature behavior diverged from spec | Post-launch review (30 days) |
| ADR | Decision Owner (named in header) | Review-by date reached, assumptions changed | Review-by date or assumption change |
| Tech Spec | Tech Lead / Senior Engineer | Code diverged from design | Post-implementation review |
| ID Spec | Backend Engineer / API owner | API changed without spec update | Any API change PR |
| Test Spec | QA Lead / feature engineer | Test suite diverged from spec | Any test refactor |
| Perf Spec | SRE / Performance Engineer | Baselines outdated, thresholds no longer meaningful | Quarterly or post-architecture change |
| Sec Review | Security Engineer | New threats, new data flows, new dependencies | Annual review or any security-sensitive change |
| Dep Review | Tech Lead | Dependency updated or abandoned | Any version bump of reviewed dep |
| Mig Guide | SRE | Migration completed | Archive after successful production migration |
| Runbook | SRE / Service Owner | Commands outdated, contacts changed | After every incident that used the runbook |

---

## 6. Anti-Patterns

### 6.1 Author = Only Consumer

When the person writing the document is the only one who will read it, the document adds overhead without value. This happens when:
- A solo engineer writes a Tech Spec, implements it themselves, and nobody reviews it
- An SRE writes a Runbook that only they will ever execute

**Fix**: If only one person will ever read it, put it in the PR description or code comments. Templates exist for cross-functional communication.

### 6.2 Author = Approver

When one person writes and approves their own documents, the adversarial review function disappears. Even on small teams, the author should never be the sole approver.

**Fix**: Minimum two-person rule. If you wrote it, someone else approves it.

### 6.3 Upstream Document Skipped

Writing a Tech Spec without an approved PRD means engineers are guessing at requirements. Writing a Mig Guide without a Tech Spec means the migration might implement the wrong design.

**Fix**: Enforce the gate structure in Section 3.3. A downstream document cannot be approved until its upstream dependency exists.

### 6.4 Document Written After Implementation

A Tech Spec written after the code is already merged is a post-hoc rationalization, not a design document. It captures what was built, not the trade-offs that led to the design.

**Fix**: The document review gate must block the PR. "Spec approved" is a merge requirement, not a follow-up task.

### 6.5 No Feedback Loop

Documents are written, approved, and never touched again. The Runbook's rollback command rots. The Perf Spec's baselines become fiction. The ADR's assumptions are never re-evaluated.

**Fix**: Assign long-term owners (Section 5.2) and define refresh triggers. Tie runbook freshness to incident retrospectives. Tie perf spec freshness to quarterly baseline re-measurement.

---

## 7. Recommended Reading Order for New Engineers

Week 1:
1. This document (you are here)
2. [Document Templates README](templates/README.md) -- when to use which template
3. [Document Matrix](../DOCUMENT_MATRIX.md) -- what documents exist for each phase
4. Most recent **BRD** -- understand why the current phase exists

Week 2:
5. Most recent **ADRs** -- understand the decisions already made
6. **Tech Spec** for the component you will work on
7. **Runbook** for the service you will be on-call for

Ongoing:
8. **ID Spec** for any API you consume or produce
9. **Test Spec** for your area before writing tests
10. **Sec Review** before touching auth, data access, or AI components

---

*This document is maintained by the Tech Lead. Update it when organizational structure changes, new document types are introduced, or information flow patterns shift.*
