# pi-viewer

A small **local-only** web app to inspect and edit the `.pi/` runtime state and `docs/phase-*` documents in this repo. Reads and writes files directly from disk — no database, no caching, no remote calls.

## What it shows

- **Sprints** — kanban board of every sprint in `.pi/state/sprints/sprint-*.yaml`. Drag tasks across status columns; click a card to edit fields in a side drawer. "Approvals only" filter surfaces tasks in `review` or `blocked`.
- **Agents** — browse and edit role/task/orchestrator personas (markdown). View any chain in `.pi/agents/chains.yaml` as a directed graph (react-flow).
- **Docs** — tree of `docs/phase-*` markdown with phase filter. Render or edit (CodeMirror).
- **State** — pretty-print of `.pi/state/progress.yaml` and a list of session JSON traces.
- **Settings & safety** — direct YAML/JSON editor for whitelisted files: `settings.json`, `safety-rules.yaml`, `agents/routing.yaml`, and the task-type templates.

All edits go through a server that:

1. Jails every path to `<repo>/.pi/**` or `<repo>/docs/**`
2. Honors `readOnlyPaths` and `zeroAccessPaths` from `.pi/safety-rules.yaml`
3. Round-trips YAML through `ruamel.yaml` so comments and key order are preserved (clean `git diff`)
4. Writes atomically (`tmp + os.replace`)
5. Binds to `127.0.0.1` only

## Run

```bash
just pi-ui-install   # one-time: uv sync (server) + npm install (web)
just pi-ui           # starts api on :7878 and vite on :5173
# open http://127.0.0.1:5173
```

Live reload: changes to `.pi/` or `docs/` files (from terminal, git, or another editor) are pushed via SSE and the affected views refresh automatically.

## Portability

The server resolves the repo root via `git rev-parse --show-toplevel`, so any teammate who clones the repo and runs the two commands above sees **their own** working tree — their sprint YAMLs, branches, and uncommitted edits. Override with `PI_VIEWER_REPO_ROOT=/path` if needed.

## Layout

```
tools/pi-viewer/
├── server/          # FastAPI + ruamel.yaml + watchfiles (Python 3.11+, uv-managed)
└── web/             # Vite + React + TS + Tailwind + react-flow + CodeMirror
```

## Notes / limits (v1)

- Settings & safety editor is raw text (validated YAML/JSON), not form-driven yet.
- Sessions JSON is read-only by design (it's ephemeral, gitignored).
- The UI does **not** invoke `pi` or `just` recipes — it only reads and writes files. To run a chain, use the terminal.
