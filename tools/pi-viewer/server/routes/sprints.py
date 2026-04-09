"""Sprint CRUD: list sprints, read full sprint, patch a single task field-set."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..fs import assert_writable, repo_root, write_atomic
from ..yaml_io import dump_yaml, load_yaml

router = APIRouter(prefix="/api/sprints", tags=["sprints"])


def _sprints_dir() -> Path:
    return repo_root() / ".pi" / "state" / "sprints"


def _sprint_files() -> list[Path]:
    return sorted(p for p in _sprints_dir().glob("sprint-*.yaml"))


def _find_sprint_file(sprint_id: int) -> Path:
    for p in _sprint_files():
        data = load_yaml(p)
        if int(data.get("id", -1)) == sprint_id:
            return p
    raise HTTPException(404, f"Sprint {sprint_id} not found")


@router.get("")
def list_sprints() -> list[dict[str, Any]]:
    out = []
    for p in _sprint_files():
        data = load_yaml(p)
        out.append(
            {
                "id": data.get("id"),
                "name": data.get("name"),
                "goal": data.get("goal"),
                "status": data.get("status"),
                "startDate": str(data.get("startDate", "")),
                "endDate": str(data.get("endDate", "")),
                "roadmapPhases": list(data.get("roadmapPhases") or []),
                "taskCount": len(data.get("backlog") or []),
                "file": str(p.relative_to(repo_root())),
            }
        )
    return out


@router.get("/{sprint_id}")
def get_sprint(sprint_id: int) -> dict[str, Any]:
    path = _find_sprint_file(sprint_id)
    data = load_yaml(path)
    # Convert ruamel CommentedMap → plain dict for JSON serialization
    import json

    return json.loads(json.dumps(data, default=str))


class TaskPatch(BaseModel):
    # All fields optional — only provided keys are updated
    title: str | None = None
    status: str | None = None
    assignee: str | None = None
    priority: str | None = None
    gate: str | None = None
    docType: str | None = None
    workstream: str | None = None
    chain: str | None = None
    output: str | None = None
    completedAt: str | None = None
    dependsOn: list[str] | None = None
    acceptanceCriteria: list[str] | None = None
    touches: list[str] | None = None


@router.patch("/{sprint_id}/tasks/{task_id}")
def patch_task(sprint_id: int, task_id: str, patch: TaskPatch) -> dict[str, Any]:
    path = _find_sprint_file(sprint_id)
    assert_writable(path)
    data = load_yaml(path)
    backlog = data.get("backlog") or []
    target = next((t for t in backlog if t.get("id") == task_id), None)
    if target is None:
        raise HTTPException(404, f"Task {task_id} not found in sprint {sprint_id}")

    updates = patch.model_dump(exclude_unset=True)
    for key, value in updates.items():
        target[key] = value

    write_atomic(path, dump_yaml(data))
    import json

    return json.loads(json.dumps(target, default=str))
