# pi-viewer — Event Descriptiveness Plan (Track D)

**Scope.** Make the pi-viewer surface agent dispatch and chain step transitions descriptively — what agent ran, for which chain, at which step, how long it took, whether it succeeded, what it was working on — not just raw filesystem diffs or a JSON blob dump.

**Status.** Plan only. Do not code until approved.

**Date.** 2026-04-08.

---

## 1. Where the data actually lives today

Two things the viewer can already see, and one thing it can't:

1. **`.pi/state/sprints/sprint-*.yaml`** — sprint backlog with per-task `status`, `assignee`, `chain`, `touches`, `completedAt`. Already surfaced on the Sprints page as a kanban board. This captures the *outcome* of dispatch (item went from `open` → `in_progress` → `done`) but not the *chain step transitions* themselves.

2. **`.pi/state/sessions/*.json`** — one file per agent invocation, named `{agent}-{epoch_ms}.json`, containing a JSONL stream of events from the pi coding-agent runtime:
   - `{"type":"session", ...}` — session header with `id`, `cwd`, `timestamp`
   - `{"type":"model_change", ...}` — model selected
   - `{"type":"message", "message":{"role":"user"|"assistant", "content":[...]}}`
   - `{"type":"tool_use"}` / `{"type":"tool_result"}` (by convention; current files in this repo only show messages + model/thinking changes because they were short runs)
   - implicit end = last event timestamp

   The viewer currently exposes these via `GET /api/state/sessions` (list) and `GET /api/state/sessions/{name}` (raw body) and renders them on the State page as a pretty-printed JSON blob. That's the "undescriptive" symptom we're fixing.

3. **What's missing: a structured chain-level dispatch log.** The chain runner in `~/development/pi-vs-claude-code/extensions/agent-chain.ts` holds chain/step state inside the extension process (`stepStates`, `activeChain`, per-step `elapsed` / `lastWork`). This is the data the TUI widget already draws — card per step with status and last line of work. But **it is ephemeral**: it lives in the extension's memory and is not written anywhere the viewer can read.

   That is the gap. Descriptive rendering is cheap once the data is on disk; without that data, the viewer can only *infer* chain boundaries heuristically.

---

## 2. Proposal — two-layer approach

### Layer A (primary, small patch to agent-chain.ts): emit a chain-events JSONL

Have the chain runner append one line per state transition to `.pi/state/chain-events.jsonl`:

```jsonl
{"t":"2026-04-08T12:01:02.301Z","kind":"chain_start","chain_id":"c_1775...","chain":"create-tech-spec","task":"Write Tech Spec for ...","steps":["scout","scout","tech-lead","doc-reviewer"]}
{"t":"...","kind":"step_start","chain_id":"c_1775...","step":0,"agent":"scout","prompt_preview":"Read the PRD ..."}
{"t":"...","kind":"step_progress","chain_id":"c_1775...","step":0,"last_work":"Scanned backend/app/services/..."}
{"t":"...","kind":"step_done","chain_id":"c_1775...","step":0,"agent":"scout","elapsed_ms":42311,"exit_code":0,"output_preview":"Found 3 call sites..."}
{"t":"...","kind":"step_error","chain_id":"c_1775...","step":2,"agent":"tech-lead","elapsed_ms":1203,"error":"agent not found"}
{"t":"...","kind":"chain_done","chain_id":"c_1775...","chain":"create-tech-spec","elapsed_ms":482117,"success":true}
```

Rationale:
- **Append-only.** Cheap to write, trivial to tail, replay-friendly.
- **One line per transition** so `tail -f` / SSE streaming / watchfiles work identically to how the viewer already handles `.pi/` file changes.
- **`chain_id` correlates with the agent session file** by including the chain_id in the pi `--session` path, or by recording the session filename in `step_start` — so clicking a step in the viewer opens the corresponding `sessions/{agent}-{ts}.json`.
- **`prompt_preview` / `output_preview`** (first/last 200 chars) are the "descriptive" bit — enough for humans to understand what the step was doing without reading the whole JSONL.

This layer is a **~30-line addition** to `agent-chain.ts` in the pi-vs-claude-code repo. It is the only thing that requires touching the chain runner itself.

### Layer B (fallback, already-landable in pi-viewer): session-trace parser

Even without Layer A, the viewer can derive most of this by parsing existing `.pi/state/sessions/*.json`:

- **Agent** — filename prefix (`backend-dev-...`, `scout-...`).
- **Start** — `session` event timestamp.
- **End** — last event timestamp.
- **Elapsed** — end − start.
- **Last work** — last assistant `text_delta` line (matches what the TUI widget uses).
- **First user message** — the task the agent was handed; serves as the "what" in place of `prompt_preview`.
- **Tool calls** — count + last tool name for a "last action" badge.

**Chain inference**: group sessions by temporal proximity (sessions within 60s of each other + any `run_chain` tool_use event in a parent session = same chain). Heuristic, but good enough to render a timeline until Layer A lands.

---

## 3. Server-side changes in pi-viewer

### 3.1 New route `GET /api/state/activity`

Returns a flat, descriptive activity feed, newest first, constructed from:

1. Layer A events (if `.pi/state/chain-events.jsonl` exists), parsed line-by-line.
2. Layer B inferred events from `.pi/state/sessions/*.json`.
3. Sprint transitions — diffs of `sprint-*.yaml` task `status` fields detected by comparing current file state to an in-memory snapshot taken at server start, then updated via the existing `watchfiles` SSE path.

Response shape:

```ts
type ActivityEvent =
  | { kind: "chain_start"; at: string; chain: string; chain_id: string; task: string; steps: string[] }
  | { kind: "step_start"; at: string; chain_id: string; step: number; agent: string; promptPreview: string; sessionFile?: string }
  | { kind: "step_done";  at: string; chain_id: string; step: number; agent: string; elapsedMs: number; outputPreview: string; sessionFile?: string }
  | { kind: "step_error"; at: string; chain_id: string; step: number; agent: string; elapsedMs: number; error: string }
  | { kind: "chain_done"; at: string; chain_id: string; chain: string; elapsedMs: number; success: boolean }
  | { kind: "task_transition"; at: string; sprintId: number; taskId: string; title: string; from: string; to: string }
  | { kind: "agent_session"; at: string; agent: string; sessionFile: string; elapsedMs: number; lastWork: string; firstUserText: string; source: "inferred" }
```

Query params:
- `?limit=200` (default 200)
- `?since=<iso>` for polling / resuming after reconnect
- `?kinds=step_start,step_done` to filter

### 3.2 Extend `GET /api/events` (SSE)

Currently only emits filesystem change payloads. Add a second event type:

```
event: activity
data: {"kind":"step_done","at":"2026-04-08T12:01:44.901Z",...}
```

Debounce: coalesce multi-line writes to `chain-events.jsonl` into a single flush per 100ms.

### 3.3 New parser module `server/activity.py`

- Single class `ActivityFeed` that owns: (a) cached session-file metadata, (b) tail position into `chain-events.jsonl`, (c) last-seen sprint task statuses.
- One public method `poll() -> list[ActivityEvent]` invoked by the route + SSE stream.
- Never reads the same file twice — keeps (inode, offset) per file.

Write tests under `tools/pi-viewer/server/tests/` (doesn't exist yet — add a minimal pytest harness) covering:
- A synthetic `chain-events.jsonl` with all five `kind` values.
- A session JSONL fixture → correct `agent_session` inference.
- Sprint YAML snapshot diff → task_transition events.

---

## 4. Web-side changes

### 4.1 New page `/activity`

Navigation entry: **Activity** (icon: `Zap` from lucide), placed between **Agents** and **Docs**.

Layout (two-pane):

```
┌──────────────────────────────┬──────────────────────────────┐
│  Timeline (grouped by chain) │  Detail pane                 │
│                              │                              │
│  ▼ create-tech-spec   482s ✓ │  step 2: tech-lead   37.4s  ✓│
│    • scout            42s ✓  │  ──────────────────────────  │
│    • scout (preflight)18s ✓  │  Input (prompt preview):     │
│    • tech-lead        37s ✓  │    "Based on the scout's..." │
│    • doc-reviewer     11s ✓  │                              │
│                              │  Output (tail):              │
│  ▼ create-mig-guide   312s ✓ │    "Created docs/phase-1/... │
│    ...                       │                              │
│  • task S4-199 → in_progress │  Session: sessions/tech-lead │
│    (sprint-4)                │  -1775703179145.json  [open] │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

Behaviors:
- **Live**: subscribes to `/api/events` SSE, prepends new events in place.
- **Collapsible chain groups**: chain_start/chain_done bookend a group; step events nest under it.
- **Descriptive one-liners** for every event — no JSON blobs on the list side. JSON is only in the detail pane and collapsed by default.
- **Click-through**: clicking a `step_done` with a `sessionFile` navigates the existing State page to the linked session (reuses `StatePage`'s current session viewer).
- **Time display**: `just now`, `2m ago`, `12:01:44`. Absolute timestamp on hover.
- **Filters**: kind (all / chain only / sprint transitions / errors), chain name (multi-select populated from seen chains), agent (multi-select).
- **Error surfacing**: `step_error` and failed `chain_done` render with a red left-border and are never collapsed.

### 4.2 Component breakdown

New files under `tools/pi-viewer/web/src/`:

```
pages/ActivityPage.tsx           # shell, query + SSE subscription, filters, layout
components/
  ActivityTimeline.tsx           # virtualized list (react-window if >500 items)
  ActivityChainGroup.tsx         # collapsible group with header + nested steps
  ActivityEventRow.tsx           # single-row renderer, dispatches on event.kind
  ActivityDetailPane.tsx         # full event detail + link to session file
  ActivityFilters.tsx            # kind/chain/agent facets
lib/
  activityStream.ts              # SSE subscription + merge-into-react-query-cache
  activityTypes.ts               # TypeScript mirror of the server's ActivityEvent union
  formatDuration.ts              # "42s", "7m 23s", "2h 04m"
```

`ActivityEventRow` is a pure switch on `event.kind` that renders a one-liner like:

- `chain_start` → `▶ create-tech-spec — "Write Tech Spec for 1.3.1 ADR..."  (4 steps)`
- `step_start` → `  ● scout — started` (grey dot, dim)
- `step_done` → `  ✓ scout — 42s — "Found 3 call sites in retrieval_service.py"` (green check)
- `step_error` → `  ✗ tech-lead — 1s — agent not found` (red cross)
- `chain_done` → `✓ create-tech-spec — 8m 02s` (chain-level summary)
- `task_transition` → `↳ S4-199 "Phase 1 dress rehearsal"  in_progress → done (sprint-4)`
- `agent_session` (fallback, no chain) → `● backend-dev — 3m 18s — "Migration 010 updated"`

Each row is ≤1 visible line at normal widths; descriptive text is the event-kind-specific 40–80 char suffix.

### 4.3 State page relation

State page keeps its current purpose (raw progress.yaml + raw session JSON), but the new Activity page becomes the landing entry for "what just happened." StatePage gets a small link from each Activity row → `/state?session={filename}` and a `?session=` query param reader to auto-select.

---

## 5. Non-goals for v1

- **No writing back** to chain-events.jsonl from the viewer — read-only. (Matches the existing "no invoke pi" constraint in `tools/pi-viewer/README.md`.)
- **No cross-repo correlation** — single working tree only.
- **No per-token streaming** — granularity is per-step, not per-message-delta. Live updates are fine-grained enough via SSE.
- **No retention policy** — `chain-events.jsonl` grows unbounded in v1. Add rotation later.

---

## 6. Order of work

1. **Decide on Layer A vs B-only.** If we commit to the agent-chain.ts patch in pi-vs-claude-code, the viewer work below is smaller and more faithful. If not, Layer B alone still delivers most of the value.
2. **(If A)** Patch `agent-chain.ts` to append `chain-events.jsonl` lines at every `stepStates` transition and on chain boundaries. ~30 lines. Commit and use locally.
3. **Server `activity.py`** — implement `ActivityFeed.poll()` with Layer B (session inference + sprint diff). Unit tests with fixtures. Wire the route + SSE event.
4. **Web `ActivityPage`** — shell + query-only (no SSE yet). Timeline + detail pane.
5. **SSE subscription + merge.** Live updates.
6. **Filters, click-through to StatePage, error styling.**
7. **(If A)** Add the `chain-events.jsonl` tailer to `ActivityFeed` so real chain events supersede the inferred `agent_session` rows whenever both are present.

Each step is independently mergeable and each one makes the UI more descriptive than the previous one.

---

## 7. Open questions (need confirmation before I start coding)

1. **Layer A or Layer B first?** Layer A is more faithful but requires touching the pi-vs-claude-code repo (out of tree). Layer B-only is self-contained here. My recommendation: **do Layer B first** (lands in this repo, unblocks the UI), then add Layer A when we next touch the chain extension.
2. **Activity page placement** — new top-level nav entry, or a tab inside the existing State page? I proposed top-level; confirm.
3. **Persistence of the inferred chain groupings** — should the server cache its groupings so a refresh doesn't re-cluster sessions, or is the heuristic cheap enough to re-run on every poll? (It's cheap; I'd skip the cache.)
4. **Error taxonomy** — are there structured error kinds I should surface beyond "exit_code != 0"? (e.g., "agent not found", "tool timeout", "model refusal"). If yes, Layer A would need to tag them; if not, a single red ✗ is sufficient.
