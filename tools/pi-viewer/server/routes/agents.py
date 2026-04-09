"""Agents endpoints: roles/tasks/orchestrators (markdown personas), chains/teams (yaml)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..fs import assert_writable, repo_root, write_atomic
from ..yaml_io import dump_yaml, load_yaml

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _agents_dir() -> Path:
    return repo_root() / ".pi" / "agents"


@router.get("/personas")
def list_personas() -> dict[str, list[dict[str, str]]]:
    """List all role/task/orchestrator personas grouped by category."""
    out: dict[str, list[dict[str, str]]] = {}
    for category in ("roles", "tasks", "orchestrators"):
        d = _agents_dir() / category
        if not d.is_dir():
            out[category] = []
            continue
        out[category] = sorted(
            [{"name": f.stem, "file": str(f.relative_to(repo_root()))} for f in d.glob("*.md")],
            key=lambda x: x["name"],
        )
    return out


@router.get("/personas/{category}/{name}")
def get_persona(category: str, name: str) -> dict[str, str]:
    if category not in ("roles", "tasks", "orchestrators"):
        raise HTTPException(400, "Invalid category")
    path = _agents_dir() / category / f"{name}.md"
    if not path.is_file():
        raise HTTPException(404, f"Persona {category}/{name} not found")
    return {"name": name, "category": category, "content": path.read_text()}


class PersonaUpdate(BaseModel):
    content: str


@router.put("/personas/{category}/{name}")
def put_persona(category: str, name: str, body: PersonaUpdate) -> dict[str, str]:
    if category not in ("roles", "tasks", "orchestrators"):
        raise HTTPException(400, "Invalid category")
    path = _agents_dir() / category / f"{name}.md"
    if not path.is_file():
        raise HTTPException(404, f"Persona {category}/{name} not found")
    assert_writable(path)
    write_atomic(path, body.content)
    return {"status": "saved"}


def _load_named_yaml(filename: str) -> Any:
    path = _agents_dir() / filename
    if not path.is_file():
        raise HTTPException(404, f"{filename} not found")
    return json.loads(json.dumps(load_yaml(path), default=str))


@router.get("/chains")
def get_chains() -> Any:
    return _load_named_yaml("chains.yaml")


@router.get("/teams")
def get_teams() -> Any:
    return _load_named_yaml("teams.yaml")


@router.get("/routing")
def get_routing() -> Any:
    return _load_named_yaml("routing.yaml")


class YamlBody(BaseModel):
    data: Any


@router.put("/{filename}")
def put_yaml(filename: str, body: YamlBody) -> dict[str, str]:
    if filename not in ("chains.yaml", "teams.yaml", "routing.yaml"):
        raise HTTPException(400, "Only chains/teams/routing yaml are editable here")
    path = _agents_dir() / filename
    assert_writable(path)
    # Validate by re-serializing through ruamel
    write_atomic(path, dump_yaml(body.data))
    return {"status": "saved"}
