# ADR-{number}: {Title}

> **Date**: {YYYY-MM-DD}
> **Decision Date**: {YYYY-MM-DD or "Pending" if still in Draft}
> **Review By**: {YYYY-MM-DD — date by which this decision should be revisited}
> **Decision Owner**: {name — responsible for triggering the review-by date and monitoring assumptions}
> **Status**: Draft | Proposed | Accepted | Deprecated | Superseded by ADR-{n}
> **Supersedes**: ADR-{n} (or "None")
> **Deciders**: {names}
> **Phase**: {phase number} | **PR**: {PR number}

## Context

{What is the technical or business situation that requires a decision? What constraints exist?}

## Assumptions

> List the assumptions this decision rests on. If any assumption changes, re-evaluate the decision. The Decision Owner is responsible for monitoring these.

- {e.g., "Anthropic API will remain available with <1s p95 latency"}
- {e.g., "Contract volume will stay under 100K/month for the next 12 months"}
- {e.g., "Team will have at least one engineer with Neo4j experience by Phase 2"}

## Scope

{What systems, services, or components are affected by this decision?}

## Decision Drivers

- {Driver 1: e.g., "python-jose is unmaintained since 2022"}
- {Driver 2: e.g., "Need sparse vector support for hybrid search"}
- {Driver 3: e.g., "Team has no Temporal experience"}

## Options Considered

> **Guidance**: If only one viable option exists, state why alternatives were ruled out inline rather than fabricating options. A single well-justified option is better than padding with strawmen.

### Option A: {Name}

{Description}

**Pros:**
- {Pro 1}
- {Pro 2}

**Cons:**
- {Con 1}
- {Con 2}

**Effort**: {S/M/L}
**Risk**: {Low/Medium/High}

### Option B: {Name}

{Description}

**Pros:**
- {Pro 1}

**Cons:**
- {Con 1}

**Effort**: {S/M/L}
**Risk**: {Low/Medium/High}

### Option C: {Name} (if applicable)

{Description}

## Decision

**Chosen option**: {Option X}, because {1-2 sentence rationale linking back to decision drivers}.

## Consequences

### Positive
- {Consequence 1}

### Negative
- {Consequence 1}

### Trade-offs & Accepted Risks
- {e.g., "Accepting higher operational complexity in exchange for better performance"}

## Follow-Up Actions

| Action | Tracking Issue |
|--------|---------------|
| {e.g., "Update pyproject.toml"} | [{PROJ-NNN}]({issue tracker URL}) |
| {e.g., "Notify team of new dependency"} | [{PROJ-NNN}]({issue tracker URL}) |

## Related Documents

| Document | Link |
|----------|------|
| Tech Spec | [Tech Spec Title](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Superseded ADR | [ADR-{n} Title](./ADR-{NNN}_{title}.md) |
| {Other} | [{Title}]({relative path}) |

## References

- {Link to relevant docs, issues, benchmarks}

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Created as Draft | {name} |
| {YYYY-MM-DD} | Moved to Proposed | {name} |
| {YYYY-MM-DD} | Accepted | {name} |
