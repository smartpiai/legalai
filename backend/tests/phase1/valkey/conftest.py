"""
Shared fixtures for Valkey (Redis-compatible) integration tests.

Phase 1 — PR 1.3.3 (IT-VK-02..09, FI-02, RT-03).

All tests in this package skip cleanly when Valkey is not reachable.
The reachability probe runs once per session.
"""
from __future__ import annotations

import os
import socket
from urllib.parse import urlparse

import pytest

try:
    import redis as _redis_sync  # redis-py is compatible with Valkey 8
except ImportError:  # pragma: no cover
    _redis_sync = None


VALKEY_URL = os.getenv("VALKEY_URL") or os.getenv("REDIS_URL", "redis://localhost:6379/0")
VALKEY_CONTAINER = os.getenv("VALKEY_CONTAINER", "legalai-valkey")


def _probe(url: str, timeout: float = 1.0) -> bool:
    """Probe Valkey once; return True if reachable."""
    if _redis_sync is None:
        return False
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
    except OSError:
        return False
    try:
        client = _redis_sync.Redis.from_url(url, socket_connect_timeout=timeout)
        return bool(client.ping())
    except Exception:
        return False
    finally:
        try:
            client.close()  # type: ignore[name-defined]
        except Exception:
            pass


@pytest.fixture(scope="session")
def valkey_url() -> str:
    return VALKEY_URL


@pytest.fixture(scope="session")
def valkey_container() -> str:
    return VALKEY_CONTAINER


@pytest.fixture(scope="session")
def valkey_available(valkey_url: str) -> bool:
    return _probe(valkey_url)


@pytest.fixture(autouse=True)
def _skip_if_valkey_unreachable(request, valkey_available: bool):
    """Autouse guard: skip every test in this package if Valkey is down."""
    if not valkey_available:
        pytest.skip("Valkey not reachable at VALKEY_URL/REDIS_URL")


@pytest.fixture()
def valkey_client(valkey_url: str):
    """Fresh sync redis-py client for a single test."""
    client = _redis_sync.Redis.from_url(valkey_url, decode_responses=True)
    try:
        yield client
    finally:
        client.close()
