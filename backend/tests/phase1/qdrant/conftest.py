"""
Shared fixtures for Qdrant 1.12+ integration tests.

Phase 1 — PR 1.4.5 (IT-QD-01..07, RT-04).

All tests in this package skip cleanly if Qdrant is not reachable.
The reachability probe runs once per session.
"""
from __future__ import annotations

import os
import socket
import uuid
from typing import Iterator, Optional

import pytest

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

try:
    from qdrant_client import QdrantClient
except ImportError:  # pragma: no cover
    QdrantClient = None  # type: ignore[assignment]

from app.core.vector_store import QdrantConnection


QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_URL = os.getenv("QDRANT_URL", f"http://{QDRANT_HOST}:{QDRANT_PORT}")


def _probe(host: str, port: int, timeout: float = 1.0) -> bool:
    if QdrantClient is None:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
    except OSError:
        return False
    try:
        client = QdrantClient(host=host, port=port, timeout=timeout)
        client.get_collections()
        return True
    except Exception:
        return False
    finally:
        try:
            client.close()  # type: ignore[name-defined]
        except Exception:
            pass


@pytest.fixture(scope="session")
def qdrant_host() -> str:
    return QDRANT_HOST


@pytest.fixture(scope="session")
def qdrant_port() -> int:
    return QDRANT_PORT


@pytest.fixture(scope="session")
def qdrant_url() -> str:
    return QDRANT_URL


@pytest.fixture(scope="session")
def qdrant_available(qdrant_host: str, qdrant_port: int) -> bool:
    return _probe(qdrant_host, qdrant_port)


@pytest.fixture(autouse=True)
def _skip_if_qdrant_unreachable(request, qdrant_available: bool) -> None:
    if not qdrant_available:
        pytest.skip("Qdrant not reachable at QDRANT_HOST:QDRANT_PORT")


@pytest.fixture()
def qdrant_raw_client(qdrant_host: str, qdrant_port: int) -> Iterator["QdrantClient"]:
    client = QdrantClient(host=qdrant_host, port=qdrant_port)
    try:
        yield client
    finally:
        try:
            client.close()
        except Exception:
            pass


@pytest.fixture()
def qdrant_connection(qdrant_host: str, qdrant_port: int) -> Iterator[QdrantConnection]:
    conn = QdrantConnection(host=qdrant_host, port=qdrant_port)
    # sync-only tests use the inner client directly
    conn.client = QdrantClient(host=qdrant_host, port=qdrant_port)
    try:
        yield conn
    finally:
        try:
            conn.client.close()
        except Exception:
            pass


@pytest.fixture()
def unique_collection_name(request) -> str:
    """A unique test collection name per test.

    Format: ``test__phase1__{test_name}__{uuid}``.
    """
    base = request.node.name.replace("[", "_").replace("]", "_")
    return f"test__phase1__{base}__{uuid.uuid4().hex[:8]}"


@pytest.fixture()
def cleanup_collection(qdrant_raw_client):
    """Register collection names to be deleted at teardown."""
    names: list[str] = []

    def _register(name: str) -> str:
        names.append(name)
        return name

    try:
        yield _register
    finally:
        for name in names:
            try:
                qdrant_raw_client.delete_collection(collection_name=name)
            except Exception:
                pass
