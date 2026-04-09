"""
IT-VK-02, IT-VK-03: SET/GET/DEL + TTL via app.core.cache.RedisCache.
"""
import asyncio
import time
import uuid

import pytest

from app.core.cache import RedisCache


@pytest.fixture()
def cache(valkey_url):
    c = RedisCache(url=valkey_url)

    async def _connect():
        await c.connect()

    asyncio.get_event_loop().run_until_complete(_connect()) if False else None
    return c


@pytest.mark.asyncio
async def test_set_get_delete_roundtrip(valkey_url):
    """IT-VK-02: basic SET/GET/DEL through the cache layer."""
    cache = RedisCache(url=valkey_url)
    await cache.connect()
    try:
        key = f"it-vk-02:{uuid.uuid4()}"
        await cache.set(key, "hello")
        assert await cache.get(key) == "hello"
        assert await cache.exists(key) is True
        await cache.delete(key)
        assert await cache.get(key) is None
        assert await cache.exists(key) is False
    finally:
        await cache.close()


@pytest.mark.asyncio
async def test_json_roundtrip(valkey_url):
    """IT-VK-02: JSON helper roundtrip."""
    cache = RedisCache(url=valkey_url)
    await cache.connect()
    try:
        key = f"it-vk-02-json:{uuid.uuid4()}"
        payload = {"tenant_id": 42, "name": "Acme", "nested": {"x": [1, 2, 3]}}
        await cache.set_json(key, payload, expire=30)
        assert await cache.get_json(key) == payload
    finally:
        await cache.close()


@pytest.mark.asyncio
async def test_ttl_expiry(valkey_url):
    """IT-VK-03: TTL is honored — key disappears after expiry."""
    cache = RedisCache(url=valkey_url)
    await cache.connect()
    try:
        key = f"it-vk-03:{uuid.uuid4()}"
        await cache.set(key, "ephemeral", expire=1)
        ttl = await cache.ttl(key)
        assert 0 < ttl <= 1
        assert await cache.get(key) == "ephemeral"
        # Wait slightly longer than TTL
        await asyncio.sleep(1.5)
        assert await cache.get(key) is None
    finally:
        await cache.close()
