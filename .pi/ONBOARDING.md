# Working with the legalai org runtime

`.pi/` is the **engineering-org runtime** — roles, skills, sprint machinery,
doc gates, safety. It is not part of the legalai product; it is how the team
*operates on* the legalai product. Product code lives in `backend/` and
`frontend/`. Process lives here.

## First-time setup

1. **Install Pi**: https://github.com/mariozechner/pi-coding-agent
2. **Install just**: `brew install just`
3. From the repo root:
   ```bash
   just                # lists every command available
   ```

## Daily commands

| What you want                          | Command                |
|----------------------------------------|------------------------|
| Plain Pi session                       | `just pi`              |
| Pi with full project context loaded    | `just ctx`             |
| Continue last session                  | `just cont`            |
| What's done / in progress / blocked    | `just standup`         |
| Current sprint state                   | `just sprint-status`   |
| Sprint kanban board                    | `just board`           |
| Which gates are unblocked              | `just gates`           |
| Doc inventory by phase                 | `just doc-status`      |
| Phase N readiness check                | `just phase-status 2`  |

`standup`, `sprint-status`, `doc-status`, `phase-status`, and `review-doc`
run **headless** (`pi -p`) — they print results and exit. Everything else
drops you into an interactive Pi session.

## Role-scoped sessions

Each recipe loads the matching persona from `.pi/agents/roles/`:

```bash
just pm           just tech-lead    just backend     just frontend
just sre          just security     just qa          just ai-eng
just data-ml      just devops       just scout       # read-only
```

## Creating documents

The router in `.pi/agents/routing.yaml` maps phrases to chains. The justfile
just sends those phrases for you:

```bash
just brd 2 ingest-pipeline       # create-brd chain (scout → pm → reviewer)
just prd 2 contract-search
just adr "use pgvector over qdrant"
just tech-spec pgvector-schema   # create-tech-spec chain
just sec-review auth-rewrite     # create-sec-review chain
just runbook neo4j-failover
```

Doc dependency order: `BRD → PRD → ADR → Tech Spec → {Test, Sec, Perf, Dep, ID, Mig} → Runbook`.
The org will warn you if you try to create a downstream doc before its upstream exists.

## Sprint state is shared via git

Sprint files live in `.pi/state/sprints/` and **are committed**. Workflow:

1. `git pull` before running anything that updates sprint state
2. Run sprint commands as normal
3. `git add .pi/state && git commit && git push` after meaningful updates

Session traces in `.pi/state/sessions/` are gitignored — they're ephemeral.

## Dev stack

| Command            | What it does                                |
|--------------------|---------------------------------------------|
| `just up`          | `docker-compose up -d`                      |
| `just down`        | `docker-compose down`                       |
| `just logs SVC`    | tail logs for one service                   |
| `just be`          | run backend (uvicorn --reload)              |
| `just be-test`     | backend tests with coverage                 |
| `just be-mig MSG`  | new alembic migration                       |
| `just be-up`       | apply migrations                            |
| `just fe`          | run frontend dev server                     |
| `just fe-test`     | frontend tests                              |
| `just fe-build`    | production build                            |

## How the pieces fit together

```
        you / teammate
              │
              ▼
         justfile          ← single command surface (this file documents it)
              │
              ▼
             pi            ← runtime (loads .pi/extensions/* automatically)
              │
              ▼
       .pi/extensions/     ← orchestrator, sprint, safety, doc-gates, ...
              │
              ▼
       .pi/agents/         ← roles, tasks, chains, teams, routing rules
              │
              ▼
        backend/ frontend/ docs/ memory-bank/   ← the legalai product
```

The justfile is the **only** thing you need to memorize. Everything else
is discoverable from `just` (the listing) or `.pi/APPEND_SYSTEM.md`
(the deep model).

## When something goes wrong

- **`just <recipe>` fails immediately** → `just --list` to confirm the recipe exists
- **Pi can't find a role file** → check `.pi/agents/roles/` for the actual filename
- **Routing doesn't match your phrase** → look at `.pi/agents/routing.yaml`,
  the regex first-match-wins; rephrase to match a rule, or open the file and add one
- **Sprint state looks stale** → `git pull` (someone else updated it)
- **Want the deep model** → read `.pi/APPEND_SYSTEM.md`
