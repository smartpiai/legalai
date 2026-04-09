set dotenv-load := true

# ── Default ─────────────────────────────────────────────────
default:
    @just --list

# ── Pi sessions ─────────────────────────────────────────────
# Plain interactive Pi (loads .pi/ extensions automatically)
pi:
    pi

# Interactive Pi with full project context preloaded via prompt.md
ctx:
    pi @prompt.md

# Continue / resume previous sessions
cont:
    pi -c

resume:
    pi -r

# ── Role-scoped sessions ────────────────────────────────────
# Each appends the role persona to the system prompt.
# Works with stock pi today; swap for /system once a system-select
# extension exists in .pi/extensions/.
pm:
    pi --append-system-prompt "$(cat .pi/agents/roles/pm.md)"

tech-lead:
    pi --append-system-prompt "$(cat .pi/agents/roles/tech-lead.md)"

backend:
    pi --append-system-prompt "$(cat .pi/agents/roles/backend-dev.md)"

frontend:
    pi --append-system-prompt "$(cat .pi/agents/roles/frontend-dev.md)"

sre:
    pi --append-system-prompt "$(cat .pi/agents/roles/sre.md)"

security:
    pi --append-system-prompt "$(cat .pi/agents/roles/security.md)"

qa:
    pi --append-system-prompt "$(cat .pi/agents/roles/qa.md)"

ai-eng:
    pi --append-system-prompt "$(cat .pi/agents/roles/ai-engineer.md)"

data-ml:
    pi --append-system-prompt "$(cat .pi/agents/roles/data-ml.md)"

devops:
    pi --append-system-prompt "$(cat .pi/agents/roles/devops.md)"

# Read-only scout session — physically cannot modify files
scout:
    pi --tools read,grep,find,ls "scout the codebase"

# ── Sprint workflow ─────────────────────────────────────────
# Headless one-shots (no TUI, exits when done — good for CI/cron)
sprint-status:
    pi -p "/sprint status"

standup:
    pi -p "/standup"

retro:
    pi -p "/retro"

doc-status:
    pi -p "/skill:doc-status"

phase-status PHASE:
    pi -p "phase {{PHASE}} status"

# Interactive (long-running, leaves you in the session)
sprint-plan PHASES:
    pi "/sprint plan {{PHASES}}"

sprint-execute:
    pi "/sprint execute"

sprint-close:
    pi "/sprint close"

board:
    pi "/board"

gates:
    pi "/gates"

# ── Doc creation (routed via .pi/agents/routing.yaml → chains.yaml) ──
brd PHASE NAME:
    pi "create a BRD for phase {{PHASE}}: {{NAME}}"

prd PHASE NAME:
    pi "create a PRD for phase {{PHASE}}: {{NAME}}"

adr NAME:
    pi "create an ADR: {{NAME}}"

tech-spec NAME:
    pi "create a tech spec: {{NAME}}"

test-spec NAME:
    pi "create a test spec: {{NAME}}"

id-spec NAME:
    pi "create an id spec: {{NAME}}"

sec-review NAME:
    pi "create a sec review: {{NAME}}"

dep-review NAME:
    pi "create a dep review: {{NAME}}"

perf-spec NAME:
    pi "create a perf spec: {{NAME}}"

runbook NAME:
    pi "create a runbook: {{NAME}}"

mig-guide NAME:
    pi "create a migration guide: {{NAME}}"

# Headless single-doc review
review-doc PATH:
    pi -p "review {{PATH}}"

# Phase-wide review (interactive — long-running chain)
phase-review PHASE:
    pi "review all docs for phase {{PHASE}}"

# Phase prep (kicks plan-phase-docs chain)
phase-prep PHASE:
    pi "prepare phase {{PHASE}}"

# ── State inspection (no Pi launch) ─────────────────────────
state-progress:
    @cat .pi/state/progress.yaml 2>/dev/null || echo "no progress.yaml yet"

state-sprint:
    @latest=$(ls -1 .pi/state/sprints/ 2>/dev/null | tail -1); \
     if [ -n "$latest" ]; then cat .pi/state/sprints/$latest; else echo "no sprint yet"; fi

state-sessions:
    @ls -lt .pi/state/sessions/ 2>/dev/null | head -20 || echo "no sessions yet"

# ── Dev stack ───────────────────────────────────────────────
up:
    docker-compose up -d

down:
    docker-compose down

logs SVC="":
    docker-compose logs -f {{SVC}}

# Backend
be:
    cd backend && uvicorn app.main:app --reload

be-test:
    cd backend && pytest tests/ --cov=app

be-mig MSG:
    cd backend && alembic revision --autogenerate -m "{{MSG}}"

be-up:
    cd backend && alembic upgrade head

# Frontend
fe:
    cd frontend && npm run dev

fe-test:
    cd frontend && npm test

fe-build:
    cd frontend && npm run build

# ── pi-viewer (local .pi/ web UI) ───────────────────────────
# One-time install of server (uv) and web (npm) deps
pi-ui-install:
    cd tools/pi-viewer/server && uv sync
    cd tools/pi-viewer/web && npm install

# Start the API (port 7878) and the Vite dev server (port 5173).
# Open http://127.0.0.1:5173
pi-ui:
    #!/usr/bin/env bash
    set -euo pipefail
    cd tools/pi-viewer
    uv --project server run uvicorn server.main:app --host 127.0.0.1 --port 7878 &
    API_PID=$!
    trap "kill $API_PID 2>/dev/null || true" EXIT
    cd web && npm run dev
