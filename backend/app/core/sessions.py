"""Session store helper (PR FU-6).

Thin wrapper around :class:`app.core.cache.RedisCache` that exposes a
session-flavored API: ``create``, ``get``, ``touch``, ``delete``. All
sessions live under the ``session:<sid>`` key namespace so they can be
scanned or swept via ``delete_pattern("session:*")`` without stepping
on other cache keys.

The store is intentionally minimal and backend-agnostic: anything that
can ``set_json`` / ``get_json`` / ``delete`` on a keyed TTL store works.
Callers that need multi-tenant scoping should include ``tenant_id`` in
the payload — this helper does not enforce tenancy itself; the caller
(usually an auth dependency) does.

IT-VK-04 (``backend/tests/phase1/valkey/test_session_store.py``) imports
this module directly instead of re-implementing the ``session:<sid>``
convention in the test.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Mapping

from app.core.cache import RedisCache

SESSION_PREFIX = "session"
DEFAULT_TTL_SECONDS = 60 * 60  # 1 hour


def _key(sid: str) -> str:
    return f"{SESSION_PREFIX}:{sid}"


@dataclass
class SessionStore:
    """Session store backed by a :class:`RedisCache`.

    The cache must already be connected (``await cache.connect()``); this
    class does not own the connection lifecycle so it can be shared with
    other cache consumers in the same process.
    """

    cache: RedisCache
    ttl_seconds: int = DEFAULT_TTL_SECONDS

    async def create(
        self,
        data: Mapping[str, Any],
        *,
        ttl: int | None = None,
        sid: str | None = None,
    ) -> str:
        """Create a new session and return its id.

        ``sid`` may be passed to reuse a caller-generated identifier
        (e.g. for deterministic tests); otherwise a uuid4 hex is used.
        """
        session_id = sid or uuid.uuid4().hex
        await self.cache.set_json(
            _key(session_id),
            dict(data),
            expire=ttl if ttl is not None else self.ttl_seconds,
        )
        return session_id

    async def get(self, sid: str) -> dict[str, Any] | None:
        """Return the session payload, or ``None`` if missing/expired."""
        return await self.cache.get_json(_key(sid))

    async def touch(
        self, sid: str, *, ttl: int | None = None
    ) -> bool:
        """Refresh a session's TTL by rewriting the payload.

        Returns ``True`` if the session existed and was refreshed,
        ``False`` if it had already expired or never existed. Implemented
        as a get + set_json rather than a bare EXPIRE so it works against
        any backend that satisfies the RedisCache interface.
        """
        payload = await self.cache.get_json(_key(sid))
        if payload is None:
            return False
        await self.cache.set_json(
            _key(sid),
            payload,
            expire=ttl if ttl is not None else self.ttl_seconds,
        )
        return True

    async def delete(self, sid: str) -> None:
        """Delete a session. Idempotent — missing keys are not an error."""
        await self.cache.delete(_key(sid))


__all__ = ["SessionStore", "SESSION_PREFIX", "DEFAULT_TTL_SECONDS"]
