"""
API key management system for the Legal AI Platform.
Provides secure API key generation, validation, and management.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import secrets
import hashlib
import logging

from fastapi import HTTPException, status, Security, Depends
from fastapi.security import APIKeyHeader, APIKeyQuery
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.core.database import get_async_session
from app.core.cache import get_redis_client


logger = logging.getLogger(__name__)


class APIKey(Base):
    """API key model for secure API access."""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Key details
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    key_prefix = Column(String(10), nullable=False)  # First few chars for identification
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Permissions and scopes
    scopes = Column(JSON, default=list)  # List of allowed scopes
    permissions = Column(JSON, default=list)  # List of specific permissions
    
    # Rate limiting
    rate_limit_per_minute = Column(Integer, nullable=True)
    rate_limit_per_hour = Column(Integer, nullable=True)
    
    # Validity
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_ip_address = Column(String(45), nullable=True)
    
    # Metadata
    metadata = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="api_keys")
    tenant = relationship("Tenant", back_populates="api_keys")
    
    def __repr__(self):
        return f"<APIKey(name='{self.name}', prefix='{self.key_prefix}')>"


class APIKeyUsageLog(Base):
    """API key usage logging for analytics and security."""
    __tablename__ = "api_key_usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=False, index=True)
    
    # Request details
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Response details
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(String(500), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationship
    api_key = relationship("APIKey")


class APIKeyService:
    """Service for managing API keys."""
    
    KEY_PREFIX = "lglai"  # Prefix for all API keys
    KEY_LENGTH = 32  # Length of random part
    
    def __init__(self, db_session: AsyncSession):
        """Initialize API key service."""
        self.db = db_session
    
    def generate_api_key(self) -> str:
        """Generate a new API key."""
        random_part = secrets.token_urlsafe(self.KEY_LENGTH)
        return f"{self.KEY_PREFIX}_{random_part}"
    
    def hash_api_key(self, api_key: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    def get_key_prefix(self, api_key: str) -> str:
        """Extract prefix from API key for identification."""
        # Return first 8 characters after the prefix
        parts = api_key.split("_")
        if len(parts) > 1 and len(parts[1]) >= 8:
            return parts[1][:8]
        return api_key[:8]
    
    async def create_api_key(
        self,
        name: str,
        user_id: int,
        tenant_id: int,
        description: Optional[str] = None,
        scopes: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None,
        rate_limit_per_minute: Optional[int] = None,
        rate_limit_per_hour: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[APIKey, str]:
        """
        Create a new API key.
        
        Returns:
            Tuple of (APIKey model, actual key string)
        """
        # Generate API key
        api_key = self.generate_api_key()
        key_hash = self.hash_api_key(api_key)
        key_prefix = self.get_key_prefix(api_key)
        
        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Create API key record
        db_api_key = APIKey(
            name=name,
            description=description,
            key_hash=key_hash,
            key_prefix=key_prefix,
            user_id=user_id,
            tenant_id=tenant_id,
            scopes=scopes or [],
            permissions=permissions or [],
            expires_at=expires_at,
            rate_limit_per_minute=rate_limit_per_minute,
            rate_limit_per_hour=rate_limit_per_hour,
            metadata=metadata or {}
        )
        
        self.db.add(db_api_key)
        await self.db.commit()
        await self.db.refresh(db_api_key)
        
        logger.info(f"Created API key '{name}' for user {user_id}")
        
        return db_api_key, api_key
    
    async def validate_api_key(self, api_key: str) -> Optional[APIKey]:
        """
        Validate an API key and return the key record if valid.
        """
        key_hash = self.hash_api_key(api_key)
        
        # Check cache first
        redis_client = await get_redis_client()
        if redis_client:
            cache_key = f"api_key:{key_hash}"
            cached = await redis_client.get(cache_key)
            if cached == "invalid":
                return None
            elif cached:
                # TODO: Deserialize cached API key
                pass
        
        # Query database
        result = await self.db.execute(
            select(APIKey).where(
                and_(
                    APIKey.key_hash == key_hash,
                    APIKey.is_active == True
                )
            )
        )
        db_api_key = result.scalar_one_or_none()
        
        if not db_api_key:
            # Cache invalid key
            if redis_client:
                await redis_client.setex(f"api_key:{key_hash}", 300, "invalid")
            return None
        
        # Check expiration
        if db_api_key.expires_at and db_api_key.expires_at < datetime.utcnow():
            return None
        
        # Update usage
        db_api_key.last_used_at = datetime.utcnow()
        db_api_key.usage_count += 1
        await self.db.commit()
        
        # Cache valid key
        if redis_client:
            # TODO: Serialize and cache API key
            pass
        
        return db_api_key
    
    async def check_rate_limit(self, api_key: APIKey, ip_address: str) -> bool:
        """
        Check if API key has exceeded rate limits.
        
        Returns:
            True if within limits, False if exceeded
        """
        redis_client = await get_redis_client()
        if not redis_client:
            return True  # Allow if Redis is not available
        
        now = datetime.utcnow()
        
        # Check per-minute limit
        if api_key.rate_limit_per_minute:
            minute_key = f"rate_limit:{api_key.id}:minute:{now.minute}"
            count = await redis_client.incr(minute_key)
            
            if count == 1:
                await redis_client.expire(minute_key, 60)
            
            if count > api_key.rate_limit_per_minute:
                return False
        
        # Check per-hour limit
        if api_key.rate_limit_per_hour:
            hour_key = f"rate_limit:{api_key.id}:hour:{now.hour}"
            count = await redis_client.incr(hour_key)
            
            if count == 1:
                await redis_client.expire(hour_key, 3600)
            
            if count > api_key.rate_limit_per_hour:
                return False
        
        return True
    
    async def log_usage(
        self,
        api_key: APIKey,
        endpoint: str,
        method: str,
        status_code: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        response_time_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """Log API key usage."""
        log_entry = APIKeyUsageLog(
            api_key_id=api_key.id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            ip_address=ip_address,
            user_agent=user_agent,
            response_time_ms=response_time_ms,
            error_message=error_message
        )
        
        self.db.add(log_entry)
        await self.db.commit()
    
    async def revoke_api_key(self, api_key_id: int) -> bool:
        """Revoke an API key."""
        result = await self.db.execute(
            select(APIKey).where(APIKey.id == api_key_id)
        )
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            return False
        
        api_key.is_active = False
        api_key.revoked_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Clear cache
        redis_client = await get_redis_client()
        if redis_client:
            await redis_client.delete(f"api_key:{api_key.key_hash}")
        
        logger.info(f"Revoked API key {api_key.name} (ID: {api_key_id})")
        
        return True
    
    async def list_api_keys(
        self,
        user_id: Optional[int] = None,
        tenant_id: Optional[int] = None,
        is_active: Optional[bool] = True
    ) -> List[APIKey]:
        """List API keys with optional filters."""
        query = select(APIKey)
        
        if user_id:
            query = query.where(APIKey.user_id == user_id)
        if tenant_id:
            query = query.where(APIKey.tenant_id == tenant_id)
        if is_active is not None:
            query = query.where(APIKey.is_active == is_active)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def rotate_api_key(self, api_key_id: int) -> tuple[APIKey, str]:
        """
        Rotate an API key (revoke old, create new).
        
        Returns:
            Tuple of (new APIKey model, actual key string)
        """
        # Get existing key
        result = await self.db.execute(
            select(APIKey).where(APIKey.id == api_key_id)
        )
        old_key = result.scalar_one_or_none()
        
        if not old_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        # Revoke old key
        await self.revoke_api_key(api_key_id)
        
        # Create new key with same settings
        return await self.create_api_key(
            name=f"{old_key.name} (rotated)",
            user_id=old_key.user_id,
            tenant_id=old_key.tenant_id,
            description=old_key.description,
            scopes=old_key.scopes,
            permissions=old_key.permissions,
            rate_limit_per_minute=old_key.rate_limit_per_minute,
            rate_limit_per_hour=old_key.rate_limit_per_hour,
            metadata={**old_key.metadata, "rotated_from": api_key_id}
        )


# FastAPI dependencies for API key authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


async def get_api_key(
    header_key: Optional[str] = Security(api_key_header),
    query_key: Optional[str] = Security(api_key_query),
    db: AsyncSession = Depends(get_async_session)
) -> Optional[APIKey]:
    """
    Dependency to get and validate API key from request.
    
    Checks header first, then query parameter.
    """
    api_key = header_key or query_key
    
    if not api_key:
        return None
    
    service = APIKeyService(db)
    db_api_key = await service.validate_api_key(api_key)
    
    if not db_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key"
        )
    
    # Check rate limits
    # TODO: Get IP address from request
    if not await service.check_rate_limit(db_api_key, ""):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="API rate limit exceeded"
        )
    
    return db_api_key


def require_api_key(scopes: Optional[List[str]] = None):
    """
    Decorator to require API key authentication with optional scope checking.
    
    Usage:
        @require_api_key(scopes=["contracts.read"])
        async def my_endpoint(api_key: APIKey = Depends(get_api_key)):
            return {"message": "Authenticated with API key"}
    """
    def decorator(func):
        async def wrapper(*args, api_key: APIKey = Depends(get_api_key), **kwargs):
            if not api_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API key required"
                )
            
            # Check scopes if specified
            if scopes:
                for scope in scopes:
                    if scope not in api_key.scopes:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"API key missing required scope: {scope}"
                        )
            
            return await func(*args, api_key=api_key, **kwargs)
        
        # Preserve function metadata
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        
        return wrapper
    return decorator