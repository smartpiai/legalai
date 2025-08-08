"""
Feature flag system for the Legal AI Platform.
Allows runtime toggling of features without code deployment.
"""
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
import json
import logging

from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.base import Base
from app.core.cache import get_redis_client


logger = logging.getLogger(__name__)


class FeatureFlagType(str, Enum):
    """Types of feature flags."""
    BOOLEAN = "boolean"
    PERCENTAGE = "percentage"
    USER_LIST = "user_list"
    TENANT_LIST = "tenant_list"
    GRADUAL_ROLLOUT = "gradual_rollout"


class FeatureFlag(Base):
    """Feature flag model for storing flag configurations."""
    __tablename__ = "feature_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    flag_type = Column(String(20), default=FeatureFlagType.BOOLEAN, nullable=False)
    
    # Flag configuration
    is_enabled = Column(Boolean, default=False, nullable=False)
    percentage = Column(Integer, default=0)  # For percentage rollout
    allowed_users = Column(JSON, default=list)  # List of user IDs
    allowed_tenants = Column(JSON, default=list)  # List of tenant IDs
    excluded_users = Column(JSON, default=list)  # Excluded user IDs
    excluded_tenants = Column(JSON, default=list)  # Excluded tenant IDs
    
    # Metadata
    metadata = Column(JSON, default=dict)
    tags = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<FeatureFlag(name='{self.name}', enabled={self.is_enabled})>"


class FeatureFlagService:
    """Service for managing and evaluating feature flags."""
    
    def __init__(self, db_session: Optional[AsyncSession] = None):
        """Initialize feature flag service."""
        self.db = db_session
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes
        
    async def is_enabled(
        self,
        flag_name: str,
        user_id: Optional[int] = None,
        tenant_id: Optional[int] = None,
        default: bool = False
    ) -> bool:
        """
        Check if a feature flag is enabled for the given context.
        
        Args:
            flag_name: Name of the feature flag
            user_id: Optional user ID for user-specific flags
            tenant_id: Optional tenant ID for tenant-specific flags
            default: Default value if flag doesn't exist
            
        Returns:
            Boolean indicating if feature is enabled
        """
        # Try to get from cache first
        flag = await self._get_flag(flag_name)
        
        if not flag:
            return default
        
        # Check if flag has expired
        if flag.expires_at and flag.expires_at < datetime.utcnow():
            return False
        
        # Evaluate based on flag type
        if flag.flag_type == FeatureFlagType.BOOLEAN:
            return flag.is_enabled
            
        elif flag.flag_type == FeatureFlagType.USER_LIST:
            if not user_id:
                return False
            if user_id in (flag.excluded_users or []):
                return False
            return user_id in (flag.allowed_users or [])
            
        elif flag.flag_type == FeatureFlagType.TENANT_LIST:
            if not tenant_id:
                return False
            if tenant_id in (flag.excluded_tenants or []):
                return False
            return tenant_id in (flag.allowed_tenants or [])
            
        elif flag.flag_type == FeatureFlagType.PERCENTAGE:
            if not user_id:
                return False
            # Use consistent hashing for gradual rollout
            hash_value = hash(f"{flag_name}:{user_id}") % 100
            return hash_value < flag.percentage
            
        elif flag.flag_type == FeatureFlagType.GRADUAL_ROLLOUT:
            # Check tenant first, then user percentage
            if tenant_id and tenant_id in (flag.allowed_tenants or []):
                if user_id:
                    hash_value = hash(f"{flag_name}:{user_id}") % 100
                    return hash_value < flag.percentage
                return True
            return False
            
        return default
    
    async def _get_flag(self, flag_name: str) -> Optional[FeatureFlag]:
        """Get flag from cache or database."""
        # Check Redis cache first
        redis_client = await get_redis_client()
        if redis_client:
            cache_key = f"feature_flag:{flag_name}"
            cached = await redis_client.get(cache_key)
            if cached:
                return FeatureFlag(**json.loads(cached))
        
        # Get from database if we have a session
        if self.db:
            result = await self.db.execute(
                select(FeatureFlag).where(FeatureFlag.name == flag_name)
            )
            flag = result.scalar_one_or_none()
            
            if flag and redis_client:
                # Cache the flag
                await redis_client.setex(
                    f"feature_flag:{flag_name}",
                    self._cache_ttl,
                    json.dumps({
                        "name": flag.name,
                        "flag_type": flag.flag_type,
                        "is_enabled": flag.is_enabled,
                        "percentage": flag.percentage,
                        "allowed_users": flag.allowed_users,
                        "allowed_tenants": flag.allowed_tenants,
                        "excluded_users": flag.excluded_users,
                        "excluded_tenants": flag.excluded_tenants,
                        "expires_at": flag.expires_at.isoformat() if flag.expires_at else None
                    })
                )
            
            return flag
        
        return None
    
    async def create_flag(
        self,
        name: str,
        description: str,
        flag_type: FeatureFlagType = FeatureFlagType.BOOLEAN,
        is_enabled: bool = False,
        **kwargs
    ) -> FeatureFlag:
        """Create a new feature flag."""
        if not self.db:
            raise RuntimeError("Database session required for creating flags")
        
        flag = FeatureFlag(
            name=name,
            description=description,
            flag_type=flag_type,
            is_enabled=is_enabled,
            **kwargs
        )
        
        self.db.add(flag)
        await self.db.commit()
        await self.db.refresh(flag)
        
        # Clear cache
        await self._clear_cache(name)
        
        return flag
    
    async def update_flag(
        self,
        flag_name: str,
        **updates
    ) -> Optional[FeatureFlag]:
        """Update an existing feature flag."""
        if not self.db:
            raise RuntimeError("Database session required for updating flags")
        
        result = await self.db.execute(
            select(FeatureFlag).where(FeatureFlag.name == flag_name)
        )
        flag = result.scalar_one_or_none()
        
        if not flag:
            return None
        
        for key, value in updates.items():
            if hasattr(flag, key):
                setattr(flag, key, value)
        
        flag.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(flag)
        
        # Clear cache
        await self._clear_cache(flag_name)
        
        return flag
    
    async def delete_flag(self, flag_name: str) -> bool:
        """Delete a feature flag."""
        if not self.db:
            raise RuntimeError("Database session required for deleting flags")
        
        result = await self.db.execute(
            select(FeatureFlag).where(FeatureFlag.name == flag_name)
        )
        flag = result.scalar_one_or_none()
        
        if not flag:
            return False
        
        await self.db.delete(flag)
        await self.db.commit()
        
        # Clear cache
        await self._clear_cache(flag_name)
        
        return True
    
    async def _clear_cache(self, flag_name: str):
        """Clear flag from cache."""
        redis_client = await get_redis_client()
        if redis_client:
            await redis_client.delete(f"feature_flag:{flag_name}")
    
    async def get_all_flags(self) -> List[FeatureFlag]:
        """Get all feature flags."""
        if not self.db:
            return []
        
        result = await self.db.execute(select(FeatureFlag))
        return result.scalars().all()
    
    async def get_enabled_features(
        self,
        user_id: Optional[int] = None,
        tenant_id: Optional[int] = None
    ) -> List[str]:
        """Get list of enabled feature names for given context."""
        flags = await self.get_all_flags()
        enabled = []
        
        for flag in flags:
            if await self.is_enabled(flag.name, user_id, tenant_id):
                enabled.append(flag.name)
        
        return enabled


# Singleton instance for easy access
_feature_flag_service = None


def get_feature_flag_service(db_session: Optional[AsyncSession] = None) -> FeatureFlagService:
    """Get or create feature flag service instance."""
    global _feature_flag_service
    if _feature_flag_service is None or db_session:
        _feature_flag_service = FeatureFlagService(db_session)
    return _feature_flag_service


# Decorator for feature flag checking
def feature_flag_required(flag_name: str, default: bool = False):
    """
    Decorator to check if a feature flag is enabled.
    
    Usage:
        @feature_flag_required("new_feature")
        async def my_endpoint():
            return {"message": "New feature enabled!"}
    """
    from functools import wraps
    from fastapi import HTTPException, status
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user and tenant from request context
            request = kwargs.get("request")
            user = getattr(request.state, "user", None) if request else None
            tenant = getattr(request.state, "tenant", None) if request else None
            
            user_id = user.id if user else None
            tenant_id = tenant.id if tenant else None
            
            service = get_feature_flag_service()
            is_enabled = await service.is_enabled(
                flag_name,
                user_id=user_id,
                tenant_id=tenant_id,
                default=default
            )
            
            if not is_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Feature '{flag_name}' is not enabled"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Predefined feature flags
class Features:
    """Predefined feature flag names."""
    # AI Features
    AI_CONTRACT_ANALYSIS = "ai_contract_analysis"
    AI_CLAUSE_EXTRACTION = "ai_clause_extraction"
    AI_RISK_ASSESSMENT = "ai_risk_assessment"
    AI_DOCUMENT_GENERATION = "ai_document_generation"
    
    # Advanced Features
    ADVANCED_SEARCH = "advanced_search"
    WORKFLOW_AUTOMATION = "workflow_automation"
    TEMPLATE_LIBRARY = "template_library"
    BULK_OPERATIONS = "bulk_operations"
    
    # Integration Features
    OAUTH_LOGIN = "oauth_login"
    SLACK_INTEGRATION = "slack_integration"
    TEAMS_INTEGRATION = "teams_integration"
    SALESFORCE_SYNC = "salesforce_sync"
    
    # Beta Features
    BETA_UI = "beta_ui"
    DARK_MODE = "dark_mode"
    MOBILE_APP = "mobile_app"
    
    # Security Features
    TWO_FACTOR_AUTH = "two_factor_auth"
    SSO_LOGIN = "sso_login"
    API_KEY_AUTH = "api_key_auth"
    
    # Billing Features
    USAGE_ANALYTICS = "usage_analytics"
    CUSTOM_BILLING = "custom_billing"
    INVOICE_GENERATION = "invoice_generation"