"""SSE endpoint streaming filesystem change events for .pi/ and docs/."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from watchfiles import awatch

from ..fs import repo_root

router = APIRouter(tags=["events"])


async def _event_stream():
    root = repo_root()
    watch_paths = [str(root / ".pi"), str(root / "docs")]
    yield "event: hello\ndata: {}\n\n"
    try:
        async for changes in awatch(*watch_paths, recursive=True):
            payload = []
            for change, path in changes:
                try:
                    rel = str(Path(path).relative_to(root))
                except ValueError:
                    continue
                # Skip noisy session writes
                if rel.startswith(".pi/state/sessions/"):
                    continue
                if "/node_modules/" in rel or rel.endswith(".tmp"):
                    continue
                payload.append({"change": change.name, "path": rel})
            if payload:
                yield f"data: {json.dumps(payload)}\n\n"
    except asyncio.CancelledError:
        return


@router.get("/api/events")
async def events() -> StreamingResponse:
    return StreamingResponse(_event_stream(), media_type="text/event-stream")
