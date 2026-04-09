"""Filesystem jail + safety rule enforcement."""
from __future__ import annotations

import os
import subprocess
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException
from pathspec import PathSpec
from ruamel.yaml import YAML


@lru_cache(maxsize=1)
def repo_root() -> Path:
    """Resolve the repo root via `git rev-parse`, falling back to walking up for .pi/."""
    env_root = os.environ.get("PI_VIEWER_REPO_ROOT")
    if env_root:
        return Path(env_root).resolve()
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=Path(__file__).parent,
            stderr=subprocess.DEVNULL,
        )
        return Path(out.decode().strip()).resolve()
    except (subprocess.CalledProcessError, FileNotFoundError):
        cur = Path(__file__).resolve()
        for parent in [cur, *cur.parents]:
            if (parent / ".pi").is_dir():
                return parent
        raise RuntimeError("Could not locate repo root (no .git or .pi found)")


def jail_roots() -> list[Path]:
    root = repo_root()
    return [root / ".pi", root / "docs"]


def resolve_safe(rel_path: str) -> Path:
    """Resolve a relative path under one of the allowed jail roots, or 400."""
    if not rel_path or ".." in Path(rel_path).parts:
        raise HTTPException(400, f"Invalid path: {rel_path}")
    root = repo_root()
    candidate = (root / rel_path).resolve()
    for jail in jail_roots():
        try:
            candidate.relative_to(jail)
            return candidate
        except ValueError:
            continue
    raise HTTPException(400, f"Path outside jail: {rel_path}")


@lru_cache(maxsize=1)
def _safety_spec() -> tuple[PathSpec, PathSpec]:
    """Load read-only and zero-access patterns from .pi/safety-rules.yaml."""
    path = repo_root() / ".pi" / "safety-rules.yaml"
    yaml = YAML(typ="safe")
    data = yaml.load(path.read_text()) if path.exists() else {}
    read_only = PathSpec.from_lines("gitwildmatch", data.get("readOnlyPaths") or [])
    zero_access = PathSpec.from_lines("gitwildmatch", data.get("zeroAccessPaths") or [])
    return read_only, zero_access


def is_read_only(abs_path: Path) -> bool:
    rel = str(abs_path.relative_to(repo_root()))
    read_only, _ = _safety_spec()
    return read_only.match_file(rel)


def is_zero_access(abs_path: Path) -> bool:
    rel = str(abs_path.relative_to(repo_root()))
    _, zero = _safety_spec()
    return zero.match_file(rel)


def assert_writable(abs_path: Path) -> None:
    if is_zero_access(abs_path):
        raise HTTPException(403, f"Zero-access path: {abs_path.name}")
    if is_read_only(abs_path):
        raise HTTPException(403, f"Read-only path: {abs_path.name}")


def write_atomic(abs_path: Path, content: str) -> None:
    """Write file atomically (tmp + replace)."""
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = abs_path.with_suffix(abs_path.suffix + ".tmp")
    tmp.write_text(content)
    os.replace(tmp, abs_path)
