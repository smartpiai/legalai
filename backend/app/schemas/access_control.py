"""
Access Control Schemas
Pydantic models for access control, permissions, and sharing
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, validator


class AccessLevel(str, Enum):
    """Access level enumeration"""
    VIEW = "VIEW"
    EDIT = "EDIT"
    DELETE = "DELETE"
    SHARE = "SHARE"
    OWNER = "OWNER"


class PermissionBase(BaseModel):
    """Base permission schema"""
    access_level: AccessLevel = AccessLevel.VIEW
    expires_at: Optional[datetime] = None


class DocumentPermissionCreate(PermissionBase):
    """Create document permission"""
    document_id: UUID
    user_id: UUID


class DocumentPermissionUpdate(BaseModel):
    """Update document permission"""
    access_level: Optional[AccessLevel] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class DocumentPermissionResponse(PermissionBase):
    """Document permission response"""
    id: UUID
    document_id: UUID
    user_id: UUID
    granted_by: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    tenant_id: UUID
    
    # User details
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class FolderCreate(BaseModel):
    """Create folder"""
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[UUID] = None
    block_inheritance: bool = False
    metadata: Optional[Dict[str, Any]] = {}


class FolderUpdate(BaseModel):
    """Update folder"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[UUID] = None
    block_inheritance: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class FolderResponse(BaseModel):
    """Folder response"""
    id: UUID
    name: str
    parent_id: Optional[UUID]
    path: str
    created_by: UUID
    block_inheritance: bool
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    tenant_id: UUID
    
    # Computed fields
    document_count: Optional[int] = 0
    subfolder_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


class FolderPermissionCreate(PermissionBase):
    """Create folder permission"""
    folder_id: UUID
    user_id: UUID
    inherit: bool = True


class FolderPermissionResponse(PermissionBase):
    """Folder permission response"""
    id: UUID
    folder_id: UUID
    user_id: UUID
    granted_by: UUID
    inherit: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    tenant_id: UUID
    
    # User details
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ShareRequest(BaseModel):
    """Document share request"""
    document_id: UUID
    recipient_email: EmailStr
    access_level: AccessLevel = AccessLevel.VIEW
    expires_at: Optional[datetime] = None
    message: Optional[str] = Field(None, max_length=1000)
    
    @validator('expires_at')
    def validate_expiry(cls, v):
        if v and v <= datetime.utcnow():
            raise ValueError("Expiry date must be in the future")
        return v


class ShareResponse(BaseModel):
    """Share response"""
    success: bool
    share_id: UUID
    share_link: str
    recipient_id: Optional[UUID] = None
    recipient_email: str
    is_external: bool
    expires_at: Optional[datetime]
    message: Optional[str] = None
    
    class Config:
        from_attributes = True


class DocumentShareResponse(BaseModel):
    """Document share details"""
    id: UUID
    document_id: UUID
    share_link: str
    recipient_email: str
    recipient_id: Optional[UUID]
    access_level: AccessLevel
    shared_by: UUID
    expires_at: Optional[datetime]
    message: Optional[str]
    is_external: bool
    access_count: int
    last_accessed_at: Optional[datetime]
    is_active: bool
    created_at: datetime
    
    # Document details
    document_title: Optional[str] = None
    
    # Sharer details
    sharer_name: Optional[str] = None
    sharer_email: Optional[str] = None
    
    class Config:
        from_attributes = True


class ExternalAccessCreate(BaseModel):
    """Create external access"""
    document_id: UUID
    email: EmailStr
    access_level: AccessLevel = AccessLevel.VIEW
    expires_at: datetime
    ip_restrictions: Optional[List[str]] = None
    
    @validator('expires_at')
    def validate_expiry(cls, v):
        if v <= datetime.utcnow():
            raise ValueError("Expiry date must be in the future")
        return v


class ExternalAccessResponse(BaseModel):
    """External access response"""
    id: UUID
    document_id: UUID
    email: str
    access_token: str
    access_level: AccessLevel
    granted_by: UUID
    expires_at: datetime
    access_count: int
    last_accessed_at: Optional[datetime]
    ip_restrictions: Optional[List[str]]
    is_active: bool
    created_at: datetime
    
    # Document details
    document_title: Optional[str] = None
    
    class Config:
        from_attributes = True


class AccessAuditLog(BaseModel):
    """Access audit log entry"""
    id: UUID
    document_id: Optional[UUID]
    folder_id: Optional[UUID]
    user_id: Optional[UUID]
    action: str
    details: Dict[str, Any]
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]
    created_at: datetime
    tenant_id: UUID
    
    # Related details
    document_title: Optional[str] = None
    folder_name: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class AccessCheckRequest(BaseModel):
    """Request to check access"""
    document_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
    user_id: UUID
    required_level: AccessLevel


class AccessCheckResponse(BaseModel):
    """Access check response"""
    has_access: bool
    access_level: Optional[AccessLevel] = None
    source: Optional[str] = None  # 'direct', 'folder', 'share', 'external'
    expires_at: Optional[datetime] = None


class BulkPermissionRequest(BaseModel):
    """Bulk permission request"""
    document_ids: List[UUID]
    user_ids: List[UUID]
    access_level: AccessLevel
    expires_at: Optional[datetime] = None


class BulkPermissionResponse(BaseModel):
    """Bulk permission response"""
    success: bool
    granted_count: int
    failed_count: int
    errors: List[Dict[str, str]] = []


class PermissionInheritance(BaseModel):
    """Permission inheritance settings"""
    folder_id: UUID
    inherit_from_parent: bool = True
    apply_to_subfolders: bool = True
    apply_to_documents: bool = True
    override_existing: bool = False


class AccessSummary(BaseModel):
    """User's access summary for a document"""
    document_id: UUID
    document_title: str
    access_level: AccessLevel
    source: str  # 'owner', 'direct', 'folder', 'share'
    granted_by: Optional[UUID]
    granted_at: Optional[datetime]
    expires_at: Optional[datetime]
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_share: bool


class UserAccessReport(BaseModel):
    """User's complete access report"""
    user_id: UUID
    user_email: str
    user_name: str
    total_documents: int
    owned_documents: int
    shared_documents: int
    folder_permissions: int
    recent_accesses: List[AccessAuditLog]
    access_summary: List[AccessSummary]
    
    class Config:
        from_attributes = True


class DocumentAccessReport(BaseModel):
    """Document's complete access report"""
    document_id: UUID
    document_title: str
    owner_id: UUID
    owner_name: str
    total_users_with_access: int
    direct_permissions: List[DocumentPermissionResponse]
    inherited_permissions: List[FolderPermissionResponse]
    active_shares: List[DocumentShareResponse]
    external_accesses: List[ExternalAccessResponse]
    recent_access_logs: List[AccessAuditLog]
    
    class Config:
        from_attributes = True