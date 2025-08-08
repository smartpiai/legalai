"""
Integration tests for Redis connection and caching operations.
Following TDD methodology - tests written before implementation.
"""
import asyncio
import json
import pytest
from typing import Any, Dict
from datetime import timedelta

from app.core.cache import (
    RedisCache,
    get_redis_client,
    cache_key_wrapper,
    invalidate_cache,
    cache_result
)


@pytest.fixture
async def redis_cache():
    """Create a Redis cache instance for testing."""
    cache = RedisCache()
    await cache.connect()
    yield cache
    await cache.flush_db()
    await cache.close()


class TestRedisConnection:
    """Test Redis connection and basic operations."""
    
    @pytest.mark.asyncio
    async def test_redis_connection(self, redis_cache: RedisCache):
        """Test that we can connect to Redis."""
        assert await redis_cache.ping() is True
    
    @pytest.mark.asyncio
    async def test_set_and_get(self, redis_cache: RedisCache):
        """Test basic set and get operations."""
        key = "test:key"
        value = "test_value"
        
        await redis_cache.set(key, value)
        result = await redis_cache.get(key)
        
        assert result == value
    
    @pytest.mark.asyncio
    async def test_set_with_expiration(self, redis_cache: RedisCache):
        """Test setting values with expiration."""
        key = "test:expiring"
        value = "will_expire"
        
        await redis_cache.set(key, value, expire=1)
        result = await redis_cache.get(key)
        assert result == value
        
        await asyncio.sleep(1.5)
        result = await redis_cache.get(key)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_delete_key(self, redis_cache: RedisCache):
        """Test deleting keys."""
        key = "test:delete"
        value = "to_delete"
        
        await redis_cache.set(key, value)
        assert await redis_cache.get(key) == value
        
        await redis_cache.delete(key)
        assert await redis_cache.get(key) is None
    
    @pytest.mark.asyncio
    async def test_exists_check(self, redis_cache: RedisCache):
        """Test checking if key exists."""
        key = "test:exists"
        
        assert await redis_cache.exists(key) is False
        
        await redis_cache.set(key, "value")
        assert await redis_cache.exists(key) is True
    
    @pytest.mark.asyncio
    async def test_increment_counter(self, redis_cache: RedisCache):
        """Test atomic increment operations."""
        key = "test:counter"
        
        result = await redis_cache.incr(key)
        assert result == 1
        
        result = await redis_cache.incr(key, amount=5)
        assert result == 6
        
        result = await redis_cache.decr(key, amount=2)
        assert result == 4


class TestRedisCaching:
    """Test Redis caching patterns and utilities."""
    
    @pytest.mark.asyncio
    async def test_json_serialization(self, redis_cache: RedisCache):
        """Test storing and retrieving JSON data."""
        key = "test:json"
        data = {
            "id": 1,
            "name": "Test",
            "values": [1, 2, 3],
            "nested": {"key": "value"}
        }
        
        await redis_cache.set_json(key, data)
        result = await redis_cache.get_json(key)
        
        assert result == data
    
    @pytest.mark.asyncio
    async def test_cache_decorator(self, redis_cache: RedisCache):
        """Test the cache_result decorator."""
        call_count = 0
        
        @cache_result(prefix="test", expire=60)
        async def expensive_function(param: str) -> Dict[str, Any]:
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.1)
            return {"result": f"processed_{param}", "count": call_count}
        
        result1 = await expensive_function("test_param")
        result2 = await expensive_function("test_param")
        result3 = await expensive_function("different_param")
        
        assert result1 == result2
        assert result1["count"] == 1
        assert result3["count"] == 2
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, redis_cache: RedisCache):
        """Test cache invalidation patterns."""
        keys = [
            "tenant:1:contracts",
            "tenant:1:users",
            "tenant:2:contracts"
        ]
        
        for key in keys:
            await redis_cache.set(key, "data")
        
        await redis_cache.delete_pattern("tenant:1:*")
        
        assert await redis_cache.get("tenant:1:contracts") is None
        assert await redis_cache.get("tenant:1:users") is None
        assert await redis_cache.get("tenant:2:contracts") == "data"
    
    @pytest.mark.asyncio
    async def test_list_operations(self, redis_cache: RedisCache):
        """Test Redis list operations."""
        key = "test:list"
        
        await redis_cache.lpush(key, "item1")
        await redis_cache.lpush(key, "item2")
        await redis_cache.rpush(key, "item3")
        
        items = await redis_cache.lrange(key, 0, -1)
        assert items == ["item2", "item1", "item3"]
        
        item = await redis_cache.lpop(key)
        assert item == "item2"
        
        length = await redis_cache.llen(key)
        assert length == 2
    
    @pytest.mark.asyncio
    async def test_set_operations(self, redis_cache: RedisCache):
        """Test Redis set operations."""
        key = "test:set"
        
        await redis_cache.sadd(key, "member1", "member2", "member3")
        
        members = await redis_cache.smembers(key)
        assert len(members) == 3
        assert "member1" in members
        
        is_member = await redis_cache.sismember(key, "member2")
        assert is_member is True
        
        is_member = await redis_cache.sismember(key, "member4")
        assert is_member is False
        
        await redis_cache.srem(key, "member1")
        count = await redis_cache.scard(key)
        assert count == 2
    
    @pytest.mark.asyncio
    async def test_hash_operations(self, redis_cache: RedisCache):
        """Test Redis hash operations."""
        key = "test:hash"
        
        await redis_cache.hset(key, "field1", "value1")
        await redis_cache.hset(key, "field2", "value2")
        
        value = await redis_cache.hget(key, "field1")
        assert value == "value1"
        
        all_values = await redis_cache.hgetall(key)
        assert all_values == {"field1": "value1", "field2": "value2"}
        
        exists = await redis_cache.hexists(key, "field2")
        assert exists is True
        
        await redis_cache.hdel(key, "field1")
        exists = await redis_cache.hexists(key, "field1")
        assert exists is False


class TestRedisMultiTenancy:
    """Test Redis operations with multi-tenant patterns."""
    
    @pytest.mark.asyncio
    async def test_tenant_key_isolation(self, redis_cache: RedisCache):
        """Test that tenant data is properly isolated."""
        tenant1_key = cache_key_wrapper("contracts", tenant_id=1)
        tenant2_key = cache_key_wrapper("contracts", tenant_id=2)
        
        await redis_cache.set(tenant1_key, "tenant1_data")
        await redis_cache.set(tenant2_key, "tenant2_data")
        
        assert await redis_cache.get(tenant1_key) == "tenant1_data"
        assert await redis_cache.get(tenant2_key) == "tenant2_data"
        
        await invalidate_cache("contracts", tenant_id=1)
        
        assert await redis_cache.get(tenant1_key) is None
        assert await redis_cache.get(tenant2_key) == "tenant2_data"
    
    @pytest.mark.asyncio
    async def test_tenant_session_management(self, redis_cache: RedisCache):
        """Test session management for multi-tenant users."""
        session_data = {
            "user_id": 123,
            "tenant_id": 1,
            "roles": ["admin", "user"]
        }
        
        session_key = f"session:tenant:1:user:123"
        await redis_cache.set_json(session_key, session_data, expire=3600)
        
        retrieved = await redis_cache.get_json(session_key)
        assert retrieved == session_data
        
        ttl = await redis_cache.ttl(session_key)
        assert 3500 < ttl <= 3600


class TestRedisPerformance:
    """Test Redis performance characteristics."""
    
    @pytest.mark.asyncio
    async def test_bulk_operations_performance(self, redis_cache: RedisCache):
        """Test performance of bulk operations."""
        import time
        
        keys_values = {f"perf:key:{i}": f"value_{i}" for i in range(100)}
        
        start_time = time.time()
        
        pipeline = redis_cache.pipeline()
        for key, value in keys_values.items():
            pipeline.set(key, value)
        await pipeline.execute()
        
        elapsed_time = time.time() - start_time
        assert elapsed_time < 1.0
        
        for key, expected_value in list(keys_values.items())[:10]:
            value = await redis_cache.get(key)
            assert value == expected_value
    
    @pytest.mark.asyncio
    async def test_concurrent_access(self, redis_cache: RedisCache):
        """Test concurrent access patterns."""
        async def increment_counter(key: str, times: int):
            for _ in range(times):
                await redis_cache.incr(key)
        
        counter_key = "test:concurrent:counter"
        
        tasks = [
            increment_counter(counter_key, 10)
            for _ in range(10)
        ]
        
        await asyncio.gather(*tasks)
        
        final_value = int(await redis_cache.get(counter_key))
        assert final_value == 100