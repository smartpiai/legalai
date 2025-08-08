"""
Redis cache implementation with multi-tenant support.
"""
import json
import functools
import hashlib
from typing import Any, Optional, Union, List, Dict, Callable
from datetime import timedelta
import redis.asyncio as redis
from app.core.config import settings


class RedisCache:
    """Redis cache client with async support."""
    
    def __init__(self, url: Optional[str] = None):
        """Initialize Redis cache client."""
        self.url = url or settings.REDIS_URL
        self.client: Optional[redis.Redis] = None
    
    async def connect(self) -> None:
        """Connect to Redis."""
        if not self.client:
            self.client = await redis.from_url(
                self.url,
                encoding="utf-8",
                decode_responses=True
            )
    
    async def close(self) -> None:
        """Close Redis connection."""
        if self.client:
            await self.client.close()
    
    async def ping(self) -> bool:
        """Check if Redis is responsive."""
        try:
            await self.client.ping()
            return True
        except Exception:
            return False
    
    async def get(self, key: str) -> Optional[str]:
        """Get value by key."""
        return await self.client.get(key)
    
    async def set(
        self,
        key: str,
        value: Union[str, int, float],
        expire: Optional[int] = None
    ) -> None:
        """Set key-value with optional expiration in seconds."""
        await self.client.set(key, value, ex=expire)
    
    async def delete(self, key: str) -> None:
        """Delete a key."""
        await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        return await self.client.exists(key) > 0
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment counter."""
        return await self.client.incr(key, amount)
    
    async def decr(self, key: str, amount: int = 1) -> int:
        """Decrement counter."""
        return await self.client.decr(key, amount)
    
    async def set_json(
        self,
        key: str,
        data: Dict[str, Any],
        expire: Optional[int] = None
    ) -> None:
        """Store JSON data."""
        json_str = json.dumps(data)
        await self.set(key, json_str, expire)
    
    async def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve JSON data."""
        data = await self.get(key)
        if data:
            return json.loads(data)
        return None
    
    async def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern."""
        cursor = 0
        while True:
            cursor, keys = await self.client.scan(cursor, match=pattern)
            if keys:
                await self.client.delete(*keys)
            if cursor == 0:
                break
    
    async def lpush(self, key: str, *values) -> None:
        """Push values to the left of a list."""
        await self.client.lpush(key, *values)
    
    async def rpush(self, key: str, *values) -> None:
        """Push values to the right of a list."""
        await self.client.rpush(key, *values)
    
    async def lpop(self, key: str) -> Optional[str]:
        """Pop value from the left of a list."""
        return await self.client.lpop(key)
    
    async def lrange(self, key: str, start: int, stop: int) -> List[str]:
        """Get range of values from a list."""
        return await self.client.lrange(key, start, stop)
    
    async def llen(self, key: str) -> int:
        """Get length of a list."""
        return await self.client.llen(key)
    
    async def sadd(self, key: str, *members) -> None:
        """Add members to a set."""
        await self.client.sadd(key, *members)
    
    async def smembers(self, key: str) -> List[str]:
        """Get all members of a set."""
        return list(await self.client.smembers(key))
    
    async def sismember(self, key: str, member: str) -> bool:
        """Check if member exists in set."""
        return await self.client.sismember(key, member)
    
    async def srem(self, key: str, *members) -> None:
        """Remove members from a set."""
        await self.client.srem(key, *members)
    
    async def scard(self, key: str) -> int:
        """Get cardinality of a set."""
        return await self.client.scard(key)
    
    async def hset(self, key: str, field: str, value: str) -> None:
        """Set hash field."""
        await self.client.hset(key, field, value)
    
    async def hget(self, key: str, field: str) -> Optional[str]:
        """Get hash field value."""
        return await self.client.hget(key, field)
    
    async def hgetall(self, key: str) -> Dict[str, str]:
        """Get all hash fields and values."""
        return await self.client.hgetall(key)
    
    async def hexists(self, key: str, field: str) -> bool:
        """Check if hash field exists."""
        return await self.client.hexists(key, field)
    
    async def hdel(self, key: str, *fields) -> None:
        """Delete hash fields."""
        await self.client.hdel(key, *fields)
    
    async def ttl(self, key: str) -> int:
        """Get time to live for a key."""
        return await self.client.ttl(key)
    
    async def flush_db(self) -> None:
        """Flush current database (use with caution)."""
        await self.client.flushdb()
    
    def pipeline(self):
        """Create a pipeline for bulk operations."""
        return self.client.pipeline()


_redis_cache: Optional[RedisCache] = None


async def get_redis_client() -> RedisCache:
    """Get Redis cache client singleton."""
    global _redis_cache
    if not _redis_cache:
        _redis_cache = RedisCache()
        await _redis_cache.connect()
    return _redis_cache


def cache_key_wrapper(
    key: str,
    tenant_id: Optional[int] = None,
    prefix: Optional[str] = None
) -> str:
    """
    Generate cache key with tenant isolation.
    
    Args:
        key: Base cache key
        tenant_id: Tenant ID for isolation
        prefix: Optional prefix
        
    Returns:
        Formatted cache key
    """
    parts = []
    if prefix:
        parts.append(prefix)
    if tenant_id:
        parts.append(f"tenant:{tenant_id}")
    parts.append(key)
    return ":".join(parts)


async def invalidate_cache(
    pattern: str,
    tenant_id: Optional[int] = None
) -> None:
    """
    Invalidate cache by pattern.
    
    Args:
        pattern: Cache key pattern
        tenant_id: Optional tenant ID for scoped invalidation
    """
    cache = await get_redis_client()
    if tenant_id:
        pattern = f"tenant:{tenant_id}:{pattern}"
    await cache.delete_pattern(pattern)


def cache_result(
    prefix: str = "cache",
    expire: int = 3600,
    key_builder: Optional[Callable] = None
):
    """
    Decorator to cache async function results.
    
    Args:
        prefix: Cache key prefix
        expire: Expiration time in seconds
        key_builder: Optional function to build cache key
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Generate key from function name and arguments
                key_parts = [prefix, func.__name__]
                if args:
                    arg_str = "_".join(str(arg) for arg in args)
                    key_parts.append(hashlib.md5(arg_str.encode()).hexdigest()[:8])
                if kwargs:
                    kwarg_str = "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
                    key_parts.append(hashlib.md5(kwarg_str.encode()).hexdigest()[:8])
                cache_key = ":".join(key_parts)
            
            # Try to get from cache
            cache = await get_redis_client()
            cached = await cache.get_json(cache_key)
            if cached is not None:
                return cached
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache.set_json(cache_key, result, expire)
            return result
        
        return wrapper
    return decorator