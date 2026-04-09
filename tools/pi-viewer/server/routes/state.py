"""State endpoints: progress.yaml + sessions JSON listing (read-only)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from ..fs import repo_root
from ..yaml_io import load_yaml

router = APIRouter(prefix="/api/state", tags=["state"])


@router.get("/progress")
def progress() -> Any:
    p = repo_root() / ".pi" / "state" / "progress.yaml"
    if not p.is_file():
        return {}
    return json.loads(json.dumps(load_yaml(p), default=str))


@router.get("/sessions")
def list_sessions() -> list[dict[str, Any]]:
    d = repo_root() / ".pi" / "state" / "sessions"
    if not d.is_dir():
        return []
    out = []
    for f in sorted(d.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        stat = f.stat()
        out.append(
            {
                "name": f.name,
                "size": stat.st_size,
                "mtime": stat.st_mtime,
            }
        )
    return out


@router.get("/sessions/{name}")
def get_session(name: str) -> Any:
    if "/" in name or ".." in name:
        raise HTTPException(400, "Invalid name")
    p = repo_root() / ".pi" / "state" / "sessions" / name
    if not p.is_file():
        raise HTTPException(404, "Not found")
    try:
        return json.loads(p.read_text())
    except Exception as e:
        raise HTTPException(500, f"Parse error: {e}")
