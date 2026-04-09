"""Raw read/write for whitelisted settings & template files."""
from __future__ import annotations

import json
from pathlib import Path

import yaml as pyyaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..fs import assert_writable, repo_root, write_atomic

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Whitelist relative paths under .pi/ that this view exposes
WHITELIST = {
    "settings.json": "json",
    "safety-rules.yaml": "yaml",
    "agents/routing.yaml": "yaml",
    "templates/task-types/ci-workflow.yaml": "yaml",
    "templates/task-types/docker-service.yaml": "yaml",
    "templates/task-types/db-migration.yaml": "yaml",
    "templates/task-types/dep-bump.yaml": "yaml",
}


@router.get("")
def list_files() -> list[dict[str, str]]:
    return [{"path": p, "kind": k} for p, k in WHITELIST.items()]


def _resolve(rel: str) -> Path:
    if rel not in WHITELIST:
        raise HTTPException(404, "Not in whitelist")
    return repo_root() / ".pi" / rel


@router.get("/file")
def get_file(path: str) -> dict[str, str]:
    p = _resolve(path)
    if not p.is_file():
        raise HTTPException(404, "Not found")
    return {"path": path, "kind": WHITELIST[path], "content": p.read_text()}


class FileWrite(BaseModel):
    content: str


@router.put("/file")
def put_file(body: FileWrite, path: str) -> dict[str, str]:
    p = _resolve(path)
    assert_writable(p)
    kind = WHITELIST[path]
    # Validate
    try:
        if kind == "json":
            json.loads(body.content)
        else:
            pyyaml.safe_load(body.content)
    except Exception as e:
        raise HTTPException(400, f"Invalid {kind}: {e}")
    write_atomic(p, body.content)
    return {"status": "saved"}
