"""Activity feed endpoint (Track D)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from ..activity import build_feed

router = APIRouter(prefix="/api/state", tags=["activity"])


@router.get("/activity")
def activity(
    limit: int = Query(200, ge=1, le=2000),
    since: str | None = Query(None),
    kinds: str | None = Query(None, description="Comma-separated: agent_session,task_transition,..."),
) -> list[dict[str, Any]]:
    parsed_kinds = None
    if kinds:
        parsed_kinds = {k.strip() for k in kinds.split(",") if k.strip()}
    return build_feed(limit=limit, since=since, kinds=parsed_kinds)  # type: ignore[arg-type]
