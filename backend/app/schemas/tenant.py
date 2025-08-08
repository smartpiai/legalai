"""
Tenant schemas for API validation.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re


class TenantSettings(BaseModel):
    """Tenant configuration settings."""
    max_users: Optional[int] = Field(default=50, ge=1, le=10000)
    max_storage_gb: Optional[int] = Field(default=100, ge=1, le=100000)
    max_contracts: Optional[int] = Field(default=1000, ge=1, le=1000000)
    features: Optional[List[str]] = Field(default_factory=lambda: ["contract_management"])
    ai_models_enabled: Optional[List[str]] = Field(default_factory=lambda: ["gpt-4"])
    custom_branding: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TenantBase(BaseModel):
    """Base tenant schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: bool = True
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TenantCreate(TenantBase):
    """Schema for creating a tenant."""
    slug: str = Field(..., min_length=1, max_length=100)
    
    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Validate slug format - lowercase, alphanumeric with hyphens."""
        if not re.match(r'^[a-z0-9]+(?:-[a-z0-9]+)*$', v):
            raise ValueError(
                'Slug must be lowercase alphanumeric with hyphens only (e.g., "my-company")'
            )
        return v


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class TenantInDB(TenantBase):
    """Tenant schema with database fields."""
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TenantResponse(BaseModel):
    """Tenant response schema."""
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TenantListResponse(BaseModel):
    """Response for paginated tenant list."""
    items: List[TenantResponse]
    total: int
    limit: int
    offset: int


class TenantStatistics(BaseModel):
    """Schema for tenant statistics."""
    tenant_id: int
    tenant_name: str
    user_count: int
    active_user_count: int
    contract_count: int
    document_count: int
    storage_used_gb: float
    storage_limit_gb: int
    last_activity: Optional[datetime] = None