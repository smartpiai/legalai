---
name: write-test-spec
description: Guide through creating a Test Specification with test cases, coverage targets, fault injection, AI eval harness, and flaky test policy
---

# Write a Test Specification

You are helping the user create a Test Spec. The Test Spec answers: **"How do we test it?"** It requires a Tech Spec upstream.

## Before You Start

1. Read the template: `docs/templates/TEST_SPEC_TEMPLATE.md`
2. Check for the upstream Tech Spec — the test strategy should validate the design
3. Check the PRD for acceptance criteria — tests must cover these

## Authorship

- **Primary author**: QA Lead or feature engineer
- **Co-contributors**: Feature engineer, SRE (fault injection)
- **Approvers**: QA Lead + Tech Lead
- **Consumers**: Engineers writing tests, CI maintainers

## Naming

```
docs/phase-{N}/{N.X}_test-spec_{component-name}.md
```

## Workflow

### 1. Scope
Define what IS and IS NOT being tested. Reference Perf Spec for performance tests, visual regression for UI appearance.

### 2. How to Run
Provide exact commands. Include prerequisites (Docker, venv, env vars).

### 3. CI Pipeline Integration
Define: which tests run on PR, nightly, and release. Set timeouts. Mark which are merge-blocking.

### 4. Coverage Targets
Set per-layer targets: Unit (e.g., 90%), Integration (all endpoints), E2E (critical paths).

### 5. Test Cases
For **Unit Tests**: ID, test case description, preconditions, input, expected output, cleanup, priority.
For **Integration Tests**: add "Services Involved" column.
For **Regression Tests**: focus on "What Could Break" from the change.
For **Edge Cases**: unusual inputs, boundary conditions, concurrent access.
For **Contract Tests**: API consumer/provider verification.
For **Fault Injection**: kill dependencies, inject latency, return errors.

### 6. AI / Model Testing (if applicable)
Define eval harness: framework, ground-truth dataset, run command.
Set accuracy thresholds with "Action if Below" for each metric.
Track API cost per test run.

### 7. Flaky Test Policy
Define: what counts as flaky, quarantine process, fix ownership, fix timeline.

## Quality Checklist

- [ ] Every PRD acceptance criterion maps to at least one test case
- [ ] Fault injection tests exist for every external dependency
- [ ] Test execution priority is defined (P0 through P3)
- [ ] CI pipeline integration specifies timeouts and merge-blocking status
- [ ] AI eval metrics have pass/fail thresholds
- [ ] Test data lifecycle covers generation, versioning, PII handling
- [ ] Flaky test policy is defined
- [ ] Pass/fail criteria are explicit
- [ ] Tech Spec is linked in Related Documents
