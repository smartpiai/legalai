"""FastAPI app entry point for pi-viewer."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .fs import repo_root
from .routes import agents, docs, events, settings as settings_route, sprints, state

app = FastAPI(title="pi-viewer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sprints.router)
app.include_router(agents.router)
app.include_router(docs.router)
app.include_router(state.router)
app.include_router(settings_route.router)
app.include_router(events.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "repo": str(repo_root())}
