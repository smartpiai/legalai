"""
Access Control API Endpoints
Provides REST API for document and folder permissions, sharing, and audit logging
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.access_control import AccessLevel
from app.services.access_control import AccessControlService
from app.schemas.access_control import (
    DocumentPermissionResponse, DocumentPermissionCreate,
    FolderPermissionResponse, FolderPermissionCreate,
    ShareRequest, ShareResponse,
    AccessCheckRequest, AccessCheckResponse,
    ExternalAccessCreate, ExternalAccessResponse,
    AccessAuditLogResponse,
    BulkPermissionRequest, BulkPermissionResponse
)
from app.core.exceptions import NotFoundError, PermissionError, ValidationError

router = APIRouter(prefix="/access-control", tags=["access-control"])
access_service = AccessControlService()


# Document permissions endpoints
@router.post("/documents/{document_id}/permissions", response_model=DocumentPermissionResponse)
async def grant_document_access(
    document_id: int = Path(..., description="Document ID"),
    permission: DocumentPermissionCreate = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grant access to a document"""
    try:
        # Check if user has permission to grant access
        can_grant = await access_service.check_access(
            db, document_id, current_user.id, AccessLevel.SHARE
        )
        if not can_grant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to grant access"
            )
        
        result = await access_service.grant_access(
            db,
            document_id=document_id,
            user_id=permission.user_id,
            access_level=permission.access_level,
            granted_by=current_user.id,
            expires_at=permission.expires_at
        )
        
        return DocumentPermissionResponse.from_orm(result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/documents/{document_id}/permissions", response_model=List[DocumentPermissionResponse])
async def list_document_permissions(
    document_id: int = Path(..., description="Document ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all permissions for a document"""
    try:
        # Check if user has permission to view permissions
        can_view = await access_service.check_access(
            db, document_id, current_user.id, AccessLevel.VIEW
        )
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view document permissions"
            )
        
        permissions = await access_service.list_document_permissions(db, document_id)
        return [DocumentPermissionResponse.from_orm(p) for p in permissions]
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/documents/{document_id}/permissions/{user_id}")
async def revoke_document_access(
    document_id: int = Path(..., description="Document ID"),
    user_id: int = Path(..., description="User ID to revoke access from"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke access to a document"""
    # Check if user has permission to revoke access
    can_revoke = await access_service.check_access(
        db, document_id, current_user.id, AccessLevel.SHARE
    )
    if not can_revoke:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to revoke access"
        )
    
    success = await access_service.revoke_access(
        db, document_id, user_id, current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    return {"message": "Access revoked successfully"}


@router.post("/documents/{document_id}/check-access", response_model=AccessCheckResponse)
async def check_document_access(
    document_id: int = Path(..., description="Document ID"),
    request: AccessCheckRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if user has required access level to document"""
    # Admin can check anyone's access, others can only check their own
    if request.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only check your own access"
        )
    
    has_access = await access_service.check_access(
        db, document_id, request.user_id, request.required_level
    )
    
    return AccessCheckResponse(
        has_access=has_access,
        document_id=document_id,
        user_id=request.user_id,
        required_level=request.required_level
    )


# Folder permissions endpoints
@router.post("/folders", response_model=FolderPermissionResponse)
async def create_folder(
    name: str,
    parent_id: Optional[int] = None,
    block_inheritance: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new folder"""
    folder = await access_service.create_folder(
        db,
        name=name,
        parent_id=parent_id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        block_inheritance=block_inheritance
    )
    
    return FolderPermissionResponse.from_orm(folder)


@router.post("/folders/{folder_id}/permissions", response_model=FolderPermissionResponse)
async def grant_folder_access(
    folder_id: int = Path(..., description="Folder ID"),
    permission: FolderPermissionCreate = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grant access to a folder"""
    try:
        # Check if user has permission to grant access
        can_grant = await access_service.check_folder_access(
            db, folder_id, current_user.id, AccessLevel.SHARE
        )
        if not can_grant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to grant folder access"
            )
        
        result = await access_service.grant_folder_access(
            db,
            folder_id=folder_id,
            user_id=permission.user_id,
            access_level=permission.access_level,
            granted_by=current_user.id,
            inherit=permission.inherit,
            expires_at=permission.expires_at
        )
        
        return FolderPermissionResponse.from_orm(result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/folders/{folder_id}/check-access", response_model=AccessCheckResponse)
async def check_folder_access(
    folder_id: int = Path(..., description="Folder ID"),
    request: AccessCheckRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Check if user has required access level to folder"""
    # Admin can check anyone's access, others can only check their own
    if request.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only check your own access"
        )
    
    has_access = await access_service.check_folder_access(
        db, folder_id, request.user_id, request.required_level
    )
    
    return AccessCheckResponse(
        has_access=has_access,
        folder_id=folder_id,
        user_id=request.user_id,
        required_level=request.required_level
    )


# Document sharing endpoints
@router.post("/documents/{document_id}/share", response_model=ShareResponse)
async def share_document(
    document_id: int = Path(..., description="Document ID"),
    request: ShareRequest = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Share a document with internal or external users"""
    try:
        # Check if user has permission to share
        can_share = await access_service.check_access(
            db, document_id, current_user.id, AccessLevel.SHARE
        )
        if not can_share:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to share document"
            )
        
        # Override document_id from path
        request.document_id = document_id
        
        result = await access_service.share_document(
            db, request, current_user.id
        )
        
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/shares/{share_link}/validate")
async def validate_share_link(
    share_link: str = Path(..., description="Share link to validate"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Validate if share link is valid for current user"""
    is_valid = await access_service.check_share_link_access(
        db, share_link, current_user.id
    )
    
    return {"valid": is_valid, "share_link": share_link}


@router.delete("/shares/{share_id}")
async def revoke_share(
    share_id: int = Path(..., description="Share ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke a share link"""
    success = await access_service.revoke_share(
        db, share_id, current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share not found"
        )
    
    return {"message": "Share revoked successfully"}


# External access endpoints
@router.post("/documents/{document_id}/external-access", response_model=ExternalAccessResponse)
async def grant_external_access(
    document_id: int = Path(..., description="Document ID"),
    request: ExternalAccessCreate = ...,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grant external access to a document"""
    try:
        # Check if user has permission to grant external access
        can_grant = await access_service.check_access(
            db, document_id, current_user.id, AccessLevel.SHARE
        )
        if not can_grant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to grant external access"
            )
        
        result = await access_service.grant_external_access(
            db,
            document_id=document_id,
            email=request.email,
            access_level=request.access_level,
            expires_at=request.expires_at,
            granted_by=current_user.id,
            ip_restrictions=request.ip_restrictions
        )
        
        return ExternalAccessResponse.from_orm(result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/external/validate")
async def validate_external_token(
    token: str,
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Validate external access token"""
    is_valid = await access_service.validate_external_token(
        db, token, document_id
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return {"valid": True, "document_id": document_id}


@router.get("/documents/{document_id}/external-access", response_model=List[ExternalAccessResponse])
async def list_external_accesses(
    document_id: int = Path(..., description="Document ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List external accesses for a document"""
    # Check if user has permission to view external accesses
    can_view = await access_service.check_access(
        db, document_id, current_user.id, AccessLevel.SHARE
    )
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view external accesses"
        )
    
    accesses = await access_service.list_external_accesses(db, document_id)
    return [ExternalAccessResponse.from_orm(a) for a in accesses]


# Audit log endpoints
@router.get("/documents/{document_id}/audit-logs", response_model=List[AccessAuditLogResponse])
async def get_document_audit_logs(
    document_id: int = Path(..., description="Document ID"),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs for a document"""
    try:
        # Check if user has permission to view audit logs
        can_view = await access_service.check_access(
            db, document_id, current_user.id, AccessLevel.VIEW
        )
        if not can_view:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view audit logs"
            )
        
        logs = await access_service.get_document_audit_logs(db, document_id, limit)
        return [AccessAuditLogResponse.from_orm(log) for log in logs]
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/users/{user_id}/access-history", response_model=List[AccessAuditLogResponse])
async def get_user_access_history(
    user_id: int = Path(..., description="User ID"),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's access history"""
    # Users can only view their own history unless admin
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only view your own access history"
        )
    
    logs = await access_service.get_user_access_history(db, user_id, limit)
    return [AccessAuditLogResponse.from_orm(log) for log in logs]


@router.get("/tenants/{tenant_id}/audit-logs", response_model=List[AccessAuditLogResponse])
async def get_tenant_audit_logs(
    tenant_id: int = Path(..., description="Tenant ID"),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get tenant's audit logs (admin only)"""
    # Only admins can view tenant-wide logs
    if current_user.role != "admin" or current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view tenant audit logs"
        )
    
    logs = await access_service.get_tenant_audit_logs(db, tenant_id, limit)
    return [AccessAuditLogResponse.from_orm(log) for log in logs]


# Bulk operations
@router.post("/bulk/permissions", response_model=BulkPermissionResponse)
async def bulk_grant_permissions(
    request: BulkPermissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grant permissions to multiple documents/users at once"""
    success_count = 0
    failed_items = []
    
    for doc_id in request.document_ids:
        # Check permission for each document
        can_grant = await access_service.check_access(
            db, doc_id, current_user.id, AccessLevel.SHARE
        )
        
        if not can_grant:
            failed_items.append({
                "document_id": str(doc_id),
                "reason": "Insufficient permissions"
            })
            continue
        
        for user_id in request.user_ids:
            try:
                await access_service.grant_access(
                    db,
                    document_id=doc_id,
                    user_id=user_id,
                    access_level=request.access_level,
                    granted_by=current_user.id,
                    expires_at=request.expires_at
                )
                success_count += 1
            except Exception as e:
                failed_items.append({
                    "document_id": str(doc_id),
                    "user_id": str(user_id),
                    "reason": str(e)
                })
    
    return BulkPermissionResponse(
        success_count=success_count,
        failed_count=len(failed_items),
        failed_items=failed_items
    )


@router.post("/documents/{document_id}/log-access")
async def log_document_access(
    document_id: int = Path(..., description="Document ID"),
    action: str = Query(..., description="Action performed"),
    details: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Log an access event for a document"""
    await access_service.log_access(
        db,
        document_id=document_id,
        user_id=current_user.id,
        action=action,
        details=details
    )
    
    return {"message": "Access logged successfully"}