"""Activity feed derivation for pi-viewer (Track D, Layer B).

Derives a descriptive per-event activity feed from two sources the
viewer already has on disk:

1. ``.pi/state/sessions/*.json`` — per-agent JSONL traces from the pi
   coding-agent runtime. One file per agent invocation. Filename shape
   is ``{agent}-{epoch_ms}.json``; the first line is always a
   ``{"type":"session", "timestamp": ...}`` header. Subsequent lines
   are events (``model_change``, ``thinking_level_change``, ``message``
   with role user/assistant/toolResult) whose ``content`` arrays may
   contain ``text``, ``toolCall``, or other typed fragments.

2. ``.pi/state/sprints/sprint-*.yaml`` — sprint backlogs. Tasks with a
   ``completedAt`` timestamp are surfaced as ``task_transition`` events.

Layer A (``.pi/state/chain-events.jsonl``) is read if present and its
events take precedence over inferred ``agent_session`` events, but is
not yet emitted by anything in this repo; the parser is forward-
compatible with it.

The feed is **recomputed from scratch on every poll**. This is cheap
(tens of files, KB-range) and avoids cache-invalidation bugs; if it
becomes slow we revisit.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Literal

from .fs import repo_root
from .yaml_io import load_yaml

# ── Event model ────────────────────────────────────────────────────

ActivityKind = Literal[
    # Layer A (preferred, not yet emitted by any producer in-repo):
    "chain_start",
    "step_start",
    "step_done",
    "step_error",
    "chain_done",
    # Layer B (derived):
    "agent_session",
    "task_transition",
]


@dataclass
class ActivityEvent:
    kind: ActivityKind
    at: str  # ISO-8601, UTC
    # Free-form per-kind fields — populated by the parser. Keeping this
    # open-ended rather than a discriminated union so the same dict
    # survives JSON round-tripping to the web UI without a per-kind
    # Pydantic model on each side.
    data: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {"kind": self.kind, "at": self.at, **self.data}


# ── Helpers ────────────────────────────────────────────────────────

_PREVIEW_LEN = 180


def _truncate(s: str, n: int = _PREVIEW_LEN) -> str:
    s = " ".join(s.split())  # collapse whitespace/newlines for a one-liner
    return s if len(s) <= n else s[: n - 1] + "…"


def _agent_from_filename(name: str) -> str:
    """``backend-dev-1775703422895.json`` → ``backend-dev``."""
    stem = name.removesuffix(".json")
    # Strip trailing `-<digits>` once.
    i = stem.rfind("-")
    if i > 0 and stem[i + 1 :].isdigit():
        return stem[:i]
    return stem


def _iso_from_ms(ms: int | float | str | None) -> str | None:
    """Best-effort ISO-8601 UTC string from several shapes."""
    if ms is None:
        return None
    if isinstance(ms, str):
        return ms
    try:
        from datetime import datetime, timezone

        return (
            datetime.fromtimestamp(float(ms) / 1000.0, tz=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except (ValueError, OSError):
        return None


# ── Session-trace parser ───────────────────────────────────────────


@dataclass
class _ParsedSession:
    file: str
    agent: str
    start: str | None
    end: str | None
    elapsed_ms: int | None
    first_user_text: str
    last_assistant_text: str
    tool_call_count: int
    last_tool_name: str | None
    cwd: str | None


def _parse_session_file(path: Path) -> _ParsedSession | None:
    """Parse one session JSONL file into a summary. Returns None on
    malformed files — the UI should never crash because a single
    session trace is bad."""
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        return None

    if not lines:
        return None

    start: str | None = None
    end: str | None = None
    first_user_text = ""
    last_assistant_text = ""
    tool_call_count = 0
    last_tool_name: str | None = None
    cwd: str | None = None

    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue

        ty = event.get("type")
        ts = event.get("timestamp")

        if ty == "session":
            start = ts or start
            cwd = event.get("cwd") or cwd

        if ts:
            end = ts  # last seen timestamp

        if ty == "message":
            msg = event.get("message") or {}
            role = msg.get("role")
            content = msg.get("content") or []
            if role == "user" and not first_user_text:
                for c in content:
                    if isinstance(c, dict) and c.get("type") == "text":
                        first_user_text = c.get("text") or ""
                        break
            elif role == "assistant":
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    ctype = c.get("type")
                    if ctype == "text":
                        text = c.get("text") or ""
                        if text:
                            last_assistant_text = text
                    elif ctype == "toolCall":
                        tool_call_count += 1
                        last_tool_name = c.get("name") or last_tool_name

    elapsed_ms: int | None = None
    if start and end and start != end:
        # Parse both ISO strings without a hard dep on dateutil.
        try:
            from datetime import datetime

            def _p(s: str) -> float:
                return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()

            elapsed_ms = int((_p(end) - _p(start)) * 1000)
        except ValueError:
            elapsed_ms = None

    return _ParsedSession(
        file=str(path.name),
        agent=_agent_from_filename(path.name),
        start=start,
        end=end,
        elapsed_ms=elapsed_ms,
        first_user_text=_truncate(first_user_text),
        last_assistant_text=_truncate(last_assistant_text),
        tool_call_count=tool_call_count,
        last_tool_name=last_tool_name,
        cwd=cwd,
    )


def _session_to_events(parsed: _ParsedSession) -> Iterable[ActivityEvent]:
    """Emit a single ``agent_session`` activity event per session file.

    We emit one summary event rather than per-line events because the
    UI is showing "what happened" not "every keystroke", and session
    files can run into hundreds of events for a single agent run.
    """
    if parsed.end is None:
        return
    yield ActivityEvent(
        kind="agent_session",
        at=parsed.end,
        data={
            "agent": parsed.agent,
            "sessionFile": parsed.file,
            "start": parsed.start,
            "end": parsed.end,
            "elapsedMs": parsed.elapsed_ms,
            "firstUserText": parsed.first_user_text,
            "lastAssistantText": parsed.last_assistant_text,
            "toolCallCount": parsed.tool_call_count,
            "lastToolName": parsed.last_tool_name,
            "source": "inferred",
        },
    )


# ── Layer A: chain-events.jsonl tailer (forward-compatible) ────────


def _layer_a_events(path: Path) -> list[ActivityEvent]:
    """Read chain-events.jsonl if present. Each line is one event of
    kind chain_start|step_start|step_done|step_error|chain_done.

    The producer for this file is not yet wired (see
    ``tools/pi-viewer/PLAN_event_descriptiveness.md`` §2 Layer A). When
    the chain runner starts emitting to it, this function becomes the
    preferred source and ``agent_session`` events will be filtered out
    for any session whose ``chain_id`` is present here.
    """
    if not path.is_file():
        return []
    out: list[ActivityEvent] = []
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        return []
    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        try:
            e = json.loads(raw)
        except json.JSONDecodeError:
            continue
        kind = e.get("kind")
        if kind not in (
            "chain_start",
            "step_start",
            "step_done",
            "step_error",
            "chain_done",
        ):
            continue
        at = e.get("t") or e.get("at")
        if not at:
            continue
        data = {k: v for k, v in e.items() if k not in ("kind", "t", "at")}
        out.append(ActivityEvent(kind=kind, at=at, data=data))
    return out


# ── Sprint task transitions ────────────────────────────────────────


def _sprint_task_transitions() -> list[ActivityEvent]:
    """Emit one ``task_transition`` event per task that has a
    ``completedAt`` timestamp. This is lossy (we don't see pending →
    in_progress transitions without a snapshot), but it captures the
    outcome most people want to see on the feed.
    """
    sprints_dir = repo_root() / ".pi" / "state" / "sprints"
    if not sprints_dir.is_dir():
        return []

    out: list[ActivityEvent] = []
    for p in sorted(sprints_dir.glob("sprint-*.yaml")):
        try:
            data = load_yaml(p)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        sprint_id = data.get("id")
        backlog = data.get("backlog") or []
        for task in backlog:
            if not isinstance(task, dict):
                continue
            completed_at = task.get("completedAt")
            if not completed_at:
                continue
            out.append(
                ActivityEvent(
                    kind="task_transition",
                    at=str(completed_at),
                    data={
                        "sprintId": sprint_id,
                        "sprintFile": p.name,
                        "taskId": task.get("id"),
                        "title": task.get("title"),
                        "from": None,  # unknown without a snapshot
                        "to": task.get("status") or "done",
                        "assignee": task.get("assignee"),
                        "chain": task.get("chain"),
                    },
                )
            )
    return out


# ── Feed aggregator ────────────────────────────────────────────────


def build_feed(
    *,
    limit: int = 200,
    since: str | None = None,
    kinds: set[ActivityKind] | None = None,
) -> list[dict[str, Any]]:
    """Return the activity feed, newest first, as a list of plain dicts
    ready to ship to the web UI.

    Recomputed from scratch on every call.
    """
    root = repo_root()
    events: list[ActivityEvent] = []

    # Layer A — always preferred when present.
    events.extend(_layer_a_events(root / ".pi" / "state" / "chain-events.jsonl"))

    # Layer B — parse every session file into a single summary event.
    sessions_dir = root / ".pi" / "state" / "sessions"
    if sessions_dir.is_dir():
        for p in sessions_dir.glob("*.json"):
            parsed = _parse_session_file(p)
            if parsed is None:
                continue
            events.extend(_session_to_events(parsed))

    # Sprint task transitions.
    events.extend(_sprint_task_transitions())

    # Sort newest first by ISO timestamp (string order is correct for
    # ISO-8601 with the same timezone marker).
    events.sort(key=lambda e: e.at, reverse=True)

    # Filters.
    if kinds:
        events = [e for e in events if e.kind in kinds]
    if since:
        events = [e for e in events if e.at > since]

    return [e.to_json() for e in events[:limit]]


__all__ = ["ActivityEvent", "ActivityKind", "build_feed"]
