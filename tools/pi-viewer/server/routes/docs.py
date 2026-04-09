"""Docs endpoints: tree of docs/phase-*, read/write markdown with frontmatter."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import frontmatter
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..fs import assert_writable, repo_root, resolve_safe, write_atomic

router = APIRouter(prefix="/api/docs", tags=["docs"])


@router.get("/tree")
def tree() -> list[dict[str, Any]]:
    """List all markdown files under docs/, with phase + frontmatter metadata."""
    root = repo_root() / "docs"
    if not root.is_dir():
        return []
    out = []
    for md in sorted(root.rglob("*.md")):
        try:
            post = frontmatter.loads(md.read_text())
            meta = post.metadata
        except Exception:
            meta = {}
        rel = str(md.relative_to(repo_root()))
        # Extract phase from path: docs/phase-0/... or docs/phase-1/...
        parts = md.relative_to(root).parts
        phase = parts[0] if parts and parts[0].startswith("phase-") else "other"
        out.append(
            {
                "path": rel,
                "name": md.name,
                "phase": phase,
                "title": meta.get("title") or md.stem,
                "docType": meta.get("doc-type") or meta.get("docType"),
                "status": meta.get("status"),
            }
        )
    return out


@router.get("/file")
def get_file(path: str = Query(...)) -> dict[str, Any]:
    abs_path = resolve_safe(path)
    if not abs_path.is_file():
        raise HTTPException(404, "Not found")
    content = abs_path.read_text()
    try:
        post = frontmatter.loads(content)
        return {"path": path, "content": content, "frontmatter": post.metadata}
    except Exception:
        return {"path": path, "content": content, "frontmatter": {}}


class FileWrite(BaseModel):
    content: str


@router.put("/file")
def put_file(body: FileWrite, path: str = Query(...)) -> dict[str, str]:
    abs_path = resolve_safe(path)
    assert_writable(abs_path)
    write_atomic(abs_path, body.content)
    return {"status": "saved"}
