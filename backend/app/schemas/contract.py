"""
Contract schemas for API validation.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class ContractStatus(str, Enum):
    """Contract status enumeration."""
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    CANCELLED = "cancelled"


class ContractType(str, Enum):
    """Contract type enumeration."""
    SERVICE = "service"
    EMPLOYMENT = "employment"
    NDA = "nda"
    PURCHASE = "purchase"
    LEASE = "lease"
    LICENSE = "license"
    PARTNERSHIP = "partnership"
    OTHER = "other"


class ContractBase(BaseModel):
    """Base contract schema."""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    contract_number: Optional[str] = Field(None, max_length=100)
    contract_type: Optional[str] = None  # Allow any string type, not just enum
    parties: Optional[Dict[str, Any]] = Field(default_factory=dict)
    contract_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ContractCreate(BaseModel):
    """Schema for creating a contract."""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    contract_number: Optional[str] = Field(None, max_length=100)
    contract_type: Optional[str] = None
    content: Optional[str] = None
    parties: Optional[Dict[str, Any]] = Field(default_factory=dict)
    contract_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ContractUpdate(BaseModel):
    """Schema for updating a contract."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    contract_number: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = None  # Will validate against ContractStatus in endpoint
    contract_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    parties: Optional[Dict[str, Any]] = None
    contract_metadata: Optional[Dict[str, Any]] = None
    content: Optional[str] = None


class ContractInDB(ContractBase):
    """Contract schema with database fields."""
    id: int
    tenant_id: int
    content: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class ContractResponse(BaseModel):
    """Contract response schema."""
    id: int
    title: str
    description: Optional[str] = None
    contract_number: Optional[str] = None
    status: str
    contract_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    signed_date: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    approved_by_id: Optional[int] = None
    parties: Dict[str, Any]
    contract_metadata: Dict[str, Any]
    version: int = 1
    is_deleted: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class ContractListResponse(BaseModel):
    """Response for paginated contract list."""
    items: List[ContractResponse]
    total: int
    limit: int
    offset: int


class ContractApproval(BaseModel):
    """Schema for contract approval/rejection."""
    action: str = Field(..., pattern="^(approve|reject)$")
    comments: Optional[str] = None


class ContractSearch(BaseModel):
    """Contract search parameters."""
    query: Optional[str] = None
    status: Optional[List[ContractStatus]] = None
    contract_type: Optional[List[ContractType]] = None
    start_date_from: Optional[date] = None
    start_date_to: Optional[date] = None
    end_date_from: Optional[date] = None
    end_date_to: Optional[date] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    tags: Optional[List[str]] = None
    party_name: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    sort_by: Optional[str] = Field(default="created_at", pattern="^(created_at|updated_at|title|value|start_date|end_date)$")
    sort_order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$")