"""IT-QD-01: Qdrant reports version >= 1.12.

Hits ``GET /`` and asserts the returned ``version`` field parses to
(major, minor) >= (1, 12).
"""
from __future__ import annotations

import re

import httpx
import pytest


_VER_RE = re.compile(r"^(\d+)\.(\d+)(?:\.(\d+))?")


def _parse(v: str) -> tuple[int, int, int]:
    m = _VER_RE.match(v.strip())
    if not m:
        pytest.fail(f"unparseable qdrant version {v!r}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)


def test_qdrant_version_ge_1_12(qdrant_url: str) -> None:
    resp = httpx.get(qdrant_url + "/", timeout=5.0)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    version = body.get("version") or body.get("qdrant_version") or body.get("title", "")
    assert version, f"no version field in root response: {body}"
    if not _VER_RE.match(str(version)):
        # Some builds return only the title; fall back to /telemetry.
        tele = httpx.get(qdrant_url + "/telemetry", timeout=5.0).json()
        version = (
            tele.get("result", {}).get("app", {}).get("version")
            or tele.get("app", {}).get("version")
            or ""
        )
    major, minor, _patch = _parse(str(version))
    assert (major, minor) >= (1, 12), f"Qdrant version {version} < 1.12"
