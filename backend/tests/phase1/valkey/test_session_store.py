"""
IT-VK-04: session create/read/expire.

Exercises the :class:`app.core.sessions.SessionStore` helper landed in
PR FU-6 against a live Valkey backend — earlier iterations of this test
re-implemented the ``session:<sid>`` convention inline because no helper
existed. The Valkey-side behavior is identical; this test now only
asserts the public SessionStore API.
"""
import asyncio

import pytest

from app.core.cache import RedisCache
from app.core.sessions import SessionStore

SESSION_TTL_SECONDS = 2


@pytest.mark.asyncio
async def test_session_create_read_expire(valkey_url):
    cache = RedisCache(url=valkey_url)
    await cache.connect()
    try:
        store = SessionStore(cache=cache, ttl_seconds=SESSION_TTL_SECONDS)

        sid = await store.create({"user_id": 1234, "roles": ["user"]})

        # Read back
        data = await store.get(sid)
        assert data is not None
        assert data["user_id"] == 1234
        assert "user" in data["roles"]

        # Expire
        await asyncio.sleep(SESSION_TTL_SECONDS + 0.5)
        assert await store.get(sid) is None
    finally:
        await cache.close()
