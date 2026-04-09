# Sprint Backlog Schema

Sprint files live in `.pi/state/sprints/sprint-N.yaml`. They are the execution
ledger consumed by chains, planners, and (eventually) the dispatcher.

## Top-level fields

| field          | type     | notes                                              |
|----------------|----------|----------------------------------------------------|
| `id`           | int      | sprint number, matches filename                    |
| `name`         | string   | human-readable name                                |
| `goal`         | string   | one-sentence sprint outcome                        |
| `startDate`    | date     | ISO `YYYY-MM-DD`                                   |
| `endDate`      | date     | ISO `YYYY-MM-DD`                                   |
| `roadmapPhases`| string[] | phase numbers this sprint touches                  |
| `status`       | enum     | `planning` / `active` / `closed`                   |
| `backlog`      | task[]   | list of tasks (see below)                          |

## Task shape (shared)

Both `doc` and `impl` tasks share these fields:

| field          | required | notes                                                                  |
|----------------|----------|------------------------------------------------------------------------|
| `id`           | yes      | `S{sprint}-{NNN}`                                                      |
| `title`        | yes      | imperative sentence                                                    |
| `type`         | yes      | `doc` \| `impl`                                                        |
| `phase`        | yes      | roadmap phase                                                          |
| `assignee`     | yes      | role name from `.pi/agents/roles/`                                     |
| `chain`        | no       | chain name from `chains.yaml`; if absent, run manually                 |
| `gate`         | yes      | `kickoff` \| `design` \| `pre-merge` \| `pre-deploy`                   |
| `status`       | yes      | `pending` \| `in_progress` \| `review` \| `done` \| `blocked`          |
| `priority`     | yes      | `p0` \| `p1` \| `p2` \| `p3`                                           |
| `dependsOn`    | yes      | list of task ids (may be empty)                                        |
| `output`       | no       | one-line result summary, set on completion                             |
| `completedAt`  | no       | ISO timestamp, set on completion                                       |

## `doc` task — extra fields

| field     | notes                                                  |
|-----------|--------------------------------------------------------|
| `docType` | `brd` \| `prd` \| `adr` \| `tech-spec` \| `id-spec` \| `test-spec` \| `perf-spec` \| `sec-review` \| `dep-review` \| `mig-guide` \| `runbook` |

## `impl` task — extra fields

| field                | notes                                                                                       |
|----------------------|---------------------------------------------------------------------------------------------|
| `workstream`         | `ci` \| `docker` \| `observability` \| `security` \| `deps` \| `migration` \| `app`         |
| `touches`            | list of file globs the task is allowed to modify (basis for parallelism + conflict checks)  |
| `acceptanceCriteria` | list of Test Spec case IDs the task must satisfy (e.g. `TS-CI-001`)                         |
| `template`           | name of the task-type template applied (e.g. `ci-workflow`)                                 |
| `artifacts`          | object: `pr`, `commit`, `migration`, etc., populated on completion                          |

## Example tasks

### doc task
```yaml
- id: S2-003
  title: Create Phase 1 Tech Spec
  type: doc
  docType: tech-spec
  phase: "1"
  assignee: tech-lead
  chain: create-tech-spec
  gate: design
  status: review
  priority: p1
  dependsOn: [S2-001]
```

### impl task — ci workflow
```yaml
- id: S3-005
  title: Add backend pytest workflow
  type: impl
  workstream: ci
  template: ci-workflow
  phase: "0"
  assignee: devops
  chain: build-ci-workflow
  gate: pre-merge
  status: pending
  priority: p1
  dependsOn: [S3-001]
  touches:
    - .github/workflows/backend-tests.yml
  acceptanceCriteria:
    - TS-CI-001
    - TS-CI-002
```

### impl task — docker service
```yaml
- id: S3-010
  title: Add Qdrant healthcheck to compose
  type: impl
  workstream: docker
  template: docker-service
  phase: "0"
  assignee: devops
  chain: build-docker-service
  gate: pre-deploy
  status: pending
  priority: p2
  dependsOn: []
  touches:
    - docker-compose.yml
  acceptanceCriteria:
    - TS-DOCKER-004
```

## Conventions

- Task ids are sprint-scoped, never reused across sprints.
- `dependsOn` is a hard ordering — a task is not runnable until every dep is `done`.
- `touches` should be as narrow as possible. The future dispatcher uses it to
  serialize tasks whose globs overlap.
- `acceptanceCriteria` references must exist in the relevant phase Test Spec.
  Tasks without acceptance criteria are not closable.
- `template` is informational for now; later the planner uses it to apply
  defaults from `.pi/templates/task-types/{template}.yaml`.
