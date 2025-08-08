"""
Access Control Service
Implements document and folder permissions, sharing, and audit logging
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.access_control import (
    AccessLevel, DocumentPermission, Folder, FolderPermission,
    DocumentShare, ExternalAccess, AccessAuditLog
)
from app.models.document import Document
from app.models.user import User
from app.schemas.access_control import (
    ShareRequest, ShareResponse, AccessCheckRequest,
    AccessCheckResponse, BulkPermissionRequest, BulkPermissionResponse,
    PermissionInheritance, AccessSummary, UserAccessReport,
    DocumentAccessReport, ExternalAccessCreate
)
from app.core.exceptions import NotFoundError, PermissionError, ValidationError


class AccessControlService:
    """Service for managing document and folder access control"""
    
    # Document-level permissions
    async def grant_access(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        access_level: AccessLevel,
        granted_by: UUID,
        expires_at: Optional[datetime] = None
    ) -> DocumentPermission:
        """Grant access to a document"""
        # Get document and users
        document = await db.get(Document, document_id)
        if not document:
            raise NotFoundError(f"Document {document_id} not found")
        
        user = await db.get(User, user_id)
        if not user:
            raise NotFoundError(f"User {user_id} not found")
        
        grantor = await db.get(User, granted_by)
        if not grantor:
            raise NotFoundError(f"Grantor {granted_by} not found")
        
        # Check tenant isolation
        if user.tenant_id != document.tenant_id:
            raise PermissionError("Cannot grant cross-tenant access")
        
        # Check if permission already exists
        existing = await db.execute(
            select(DocumentPermission).where(
                and_(
                    DocumentPermission.document_id == document_id,
                    DocumentPermission.user_id == user_id
                )
            )
        )
        permission = existing.scalar_one_or_none()
        
        if permission:
            # Update existing permission
            permission.access_level = access_level.value
            permission.expires_at = expires_at
            permission.is_active = True
            permission.updated_at = datetime.utcnow()
        else:
            # Create new permission
            permission = DocumentPermission(
                document_id=document_id,
                user_id=user_id,
                access_level=access_level.value,
                granted_by=granted_by,
                expires_at=expires_at,
                tenant_id=document.tenant_id
            )
            db.add(permission)
        
        # Log the grant
        await self._log_permission_change(
            db, document_id, granted_by, "GRANT_ACCESS",
            {"granted_to": str(user_id), "access_level": access_level.value}
        )
        
        await db.commit()
        return permission
    
    async def check_access(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        required_level: AccessLevel
    ) -> bool:
        """Check if user has required access level to document"""
        # Get document
        document = await db.get(Document, document_id)
        if not document:
            return False
        
        # Check if user is owner
        if document.created_by == user_id:
            return True
        
        # Check direct permissions
        result = await db.execute(
            select(DocumentPermission).where(
                and_(
                    DocumentPermission.document_id == document_id,
                    DocumentPermission.user_id == user_id,
                    DocumentPermission.is_active == True
                )
            )
        )
        permission = result.scalar_one_or_none()
        
        if permission and not permission.is_expired():
            if permission.has_level(required_level):
                return True
        
        # Check folder permissions if document has folder
        if document.folder_id:
            folder_access = await self._check_folder_inherited_access(
                db, document.folder_id, user_id, required_level
            )
            if folder_access:
                return True
        
        # Check share links
        share_access = await self._check_share_access(
            db, document_id, user_id, required_level
        )
        
        return share_access
    
    async def revoke_access(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        revoked_by: UUID
    ) -> bool:
        """Revoke access to a document"""
        result = await db.execute(
            select(DocumentPermission).where(
                and_(
                    DocumentPermission.document_id == document_id,
                    DocumentPermission.user_id == user_id
                )
            )
        )
        permission = result.scalar_one_or_none()
        
        if permission:
            permission.is_active = False
            permission.updated_at = datetime.utcnow()
            
            # Log the revoke
            await self._log_permission_change(
                db, document_id, revoked_by, "REVOKE_ACCESS",
                {"revoked_from": str(user_id)}
            )
            
            await db.commit()
            return True
        
        return False
    
    async def list_document_permissions(
        self,
        db: AsyncSession,
        document_id: UUID
    ) -> List[DocumentPermission]:
        """List all permissions for a document"""
        # Get document with owner
        document = await db.get(Document, document_id)
        if not document:
            raise NotFoundError(f"Document {document_id} not found")
        
        # Get all permissions
        result = await db.execute(
            select(DocumentPermission)
            .options(selectinload(DocumentPermission.user))
            .where(
                and_(
                    DocumentPermission.document_id == document_id,
                    DocumentPermission.is_active == True
                )
            )
        )
        permissions = list(result.scalars().all())
        
        # Add owner as OWNER permission
        owner_permission = DocumentPermission(
            id=document.created_by,
            document_id=document_id,
            user_id=document.created_by,
            access_level=AccessLevel.OWNER.value,
            granted_by=document.created_by,
            tenant_id=document.tenant_id
        )
        permissions.insert(0, owner_permission)
        
        return permissions
    
    # Folder permissions
    async def create_folder(
        self,
        db: AsyncSession,
        name: str,
        parent_id: Optional[UUID],
        tenant_id: UUID,
        created_by: UUID,
        block_inheritance: bool = False
    ) -> Folder:
        """Create a new folder"""
        # Calculate path
        path = f"/{name}"
        if parent_id:
            parent = await db.get(Folder, parent_id)
            if parent:
                path = f"{parent.path}/{name}"
        
        folder = Folder(
            name=name,
            parent_id=parent_id,
            path=path,
            tenant_id=tenant_id,
            created_by=created_by,
            block_inheritance=block_inheritance
        )
        
        db.add(folder)
        await db.commit()
        await db.refresh(folder)
        
        return folder
    
    async def grant_folder_access(
        self,
        db: AsyncSession,
        folder_id: UUID,
        user_id: UUID,
        access_level: AccessLevel,
        granted_by: UUID,
        inherit: bool = True,
        expires_at: Optional[datetime] = None
    ) -> FolderPermission:
        """Grant access to a folder"""
        # Check if permission exists
        existing = await db.execute(
            select(FolderPermission).where(
                and_(
                    FolderPermission.folder_id == folder_id,
                    FolderPermission.user_id == user_id
                )
            )
        )
        permission = existing.scalar_one_or_none()
        
        if permission:
            # Update existing
            permission.access_level = access_level.value
            permission.inherit = inherit
            permission.expires_at = expires_at
            permission.is_active = True
        else:
            # Get folder for tenant_id
            folder = await db.get(Folder, folder_id)
            if not folder:
                raise NotFoundError(f"Folder {folder_id} not found")
            
            # Create new permission
            permission = FolderPermission(
                folder_id=folder_id,
                user_id=user_id,
                access_level=access_level.value,
                granted_by=granted_by,
                inherit=inherit,
                expires_at=expires_at,
                tenant_id=folder.tenant_id
            )
            db.add(permission)
        
        await db.commit()
        return permission
    
    async def check_folder_access(
        self,
        db: AsyncSession,
        folder_id: UUID,
        user_id: UUID,
        required_level: AccessLevel
    ) -> bool:
        """Check if user has access to folder"""
        # Get folder
        folder = await db.get(Folder, folder_id)
        if not folder:
            return False
        
        # Check if user is creator
        if folder.created_by == user_id:
            return True
        
        # Check direct folder permissions
        result = await db.execute(
            select(FolderPermission).where(
                and_(
                    FolderPermission.folder_id == folder_id,
                    FolderPermission.user_id == user_id,
                    FolderPermission.is_active == True
                )
            )
        )
        permission = result.scalar_one_or_none()
        
        if permission:
            perm_obj = DocumentPermission()
            perm_obj.access_level = permission.access_level
            if perm_obj.has_level(required_level):
                return True
        
        # Check parent folder if not blocking inheritance
        if not folder.block_inheritance and folder.parent_id:
            return await self._check_folder_inherited_access(
                db, folder.parent_id, user_id, required_level
            )
        
        return False
    
    async def _check_folder_inherited_access(
        self,
        db: AsyncSession,
        folder_id: UUID,
        user_id: UUID,
        required_level: AccessLevel
    ) -> bool:
        """Check inherited folder access"""
        folder = await db.get(Folder, folder_id)
        if not folder:
            return False
        
        # Check this folder's permissions
        result = await db.execute(
            select(FolderPermission).where(
                and_(
                    FolderPermission.folder_id == folder_id,
                    FolderPermission.user_id == user_id,
                    FolderPermission.inherit == True,
                    FolderPermission.is_active == True
                )
            )
        )
        permission = result.scalar_one_or_none()
        
        if permission:
            perm_obj = DocumentPermission()
            perm_obj.access_level = permission.access_level
            if perm_obj.has_level(required_level):
                return True
        
        # Check parent recursively if not blocking
        if not folder.block_inheritance and folder.parent_id:
            return await self._check_folder_inherited_access(
                db, folder.parent_id, user_id, required_level
            )
        
        return False
    
    # Sharing capabilities
    async def share_document(
        self,
        db: AsyncSession,
        request: ShareRequest,
        shared_by: UUID
    ) -> ShareResponse:
        """Share a document"""
        # Check if recipient is internal user
        user_result = await db.execute(
            select(User).where(User.email == request.recipient_email)
        )
        recipient = user_result.scalar_one_or_none()
        
        # Get document
        document = await db.get(Document, request.document_id)
        if not document:
            raise NotFoundError(f"Document {request.document_id} not found")
        
        # Create share
        share = DocumentShare(
            document_id=request.document_id,
            share_link=self._generate_share_link(),
            recipient_email=request.recipient_email,
            recipient_id=recipient.id if recipient else None,
            access_level=request.access_level.value,
            shared_by=shared_by,
            expires_at=request.expires_at,
            message=request.message,
            is_external=recipient is None,
            tenant_id=document.tenant_id
        )
        
        db.add(share)
        await db.commit()
        await db.refresh(share)
        
        return ShareResponse(
            success=True,
            share_id=share.id,
            share_link=share.share_link,
            recipient_id=share.recipient_id,
            recipient_email=share.recipient_email,
            is_external=share.is_external,
            expires_at=share.expires_at,
            message=share.message
        )
    
    async def check_share_link_access(
        self,
        db: AsyncSession,
        share_link: str,
        user_id: int
    ) -> bool:
        """Check if share link is valid for user"""
        result = await db.execute(
            select(DocumentShare).where(
                and_(
                    DocumentShare.share_link == share_link,
                    DocumentShare.is_active == True
                )
            )
        )
        share = result.scalar_one_or_none()
        
        if not share:
            return False
        
        # Check if expired
        if share.is_expired():
            return False
        
        # Check if user matches recipient
        if share.recipient_id and share.recipient_id != user_id:
            return False
        
        # Update access count
        share.access_count += 1
        share.last_accessed_at = datetime.utcnow()
        await db.commit()
        
        return True
    
    async def revoke_share(
        self,
        db: AsyncSession,
        share_id: UUID,
        revoked_by: UUID
    ) -> bool:
        """Revoke a share link"""
        share = await db.get(DocumentShare, share_id)
        if share:
            share.is_active = False
            share.updated_at = datetime.utcnow()
            await db.commit()
            return True
        return False
    
    async def _check_share_access(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        required_level: AccessLevel
    ) -> bool:
        """Check if user has access via share"""
        # Get user for email
        user = await db.get(User, user_id)
        if not user:
            return False
        
        result = await db.execute(
            select(DocumentShare).where(
                and_(
                    DocumentShare.document_id == document_id,
                    or_(
                        DocumentShare.recipient_id == user_id,
                        DocumentShare.recipient_email == user.email
                    ),
                    DocumentShare.is_active == True
                )
            )
        )
        shares = result.scalars().all()
        
        for share in shares:
            if not share.is_expired():
                perm = DocumentPermission()
                perm.access_level = share.access_level
                if perm.has_level(required_level):
                    return True
        
        return False
    
    # External access
    async def grant_external_access(
        self,
        db: AsyncSession,
        document_id: UUID,
        email: str,
        access_level: AccessLevel,
        expires_at: datetime,
        granted_by: UUID,
        ip_restrictions: Optional[List[str]] = None
    ) -> ExternalAccess:
        """Grant external access to document"""
        # Get document for tenant_id
        document = await db.get(Document, document_id)
        if not document:
            raise NotFoundError(f"Document {document_id} not found")
        
        external = ExternalAccess(
            document_id=document_id,
            email=email,
            access_token=self._generate_external_token(),
            access_level=access_level.value,
            granted_by=granted_by,
            expires_at=expires_at,
            ip_restrictions=ip_restrictions
        )
        
        db.add(external)
        await db.commit()
        await db.refresh(external)
        
        return external
    
    async def validate_external_token(
        self,
        db: AsyncSession,
        token: str,
        document_id: UUID
    ) -> bool:
        """Validate external access token"""
        result = await db.execute(
            select(ExternalAccess).where(
                and_(
                    ExternalAccess.access_token == token,
                    ExternalAccess.document_id == document_id,
                    ExternalAccess.is_active == True
                )
            )
        )
        external = result.scalar_one_or_none()
        
        if not external:
            return False
        
        if external.is_expired():
            return False
        
        # Update access count
        external.access_count += 1
        external.last_accessed_at = datetime.utcnow()
        await db.commit()
        
        return True
    
    async def list_external_accesses(
        self,
        db: AsyncSession,
        document_id: UUID
    ) -> List[ExternalAccess]:
        """List external accesses for document"""
        result = await db.execute(
            select(ExternalAccess).where(
                and_(
                    ExternalAccess.document_id == document_id,
                    ExternalAccess.is_active == True
                )
            )
        )
        return list(result.scalars().all())
    
    # Audit logging
    async def log_access(
        self,
        db: AsyncSession,
        document_id: Optional[UUID] = None,
        folder_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        action: str = "VIEW",
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None
    ):
        """Log an access event"""
        # Get tenant_id from document or folder
        tenant_id = None
        if document_id:
            doc = await db.get(Document, document_id)
            if doc:
                tenant_id = doc.tenant_id
        elif folder_id:
            folder = await db.get(Folder, folder_id)
            if folder:
                tenant_id = folder.tenant_id
        
        log = AccessAuditLog(
            document_id=document_id,
            folder_id=folder_id,
            user_id=user_id,
            action=action,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            session_id=session_id,
            tenant_id=tenant_id
        )
        
        db.add(log)
        await db.commit()
    
    async def get_document_audit_logs(
        self,
        db: AsyncSession,
        document_id: UUID,
        limit: int = 100
    ) -> List[AccessAuditLog]:
        """Get audit logs for document"""
        result = await db.execute(
            select(AccessAuditLog)
            .where(AccessAuditLog.document_id == document_id)
            .order_by(AccessAuditLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_user_access_history(
        self,
        db: AsyncSession,
        user_id: UUID,
        limit: int = 100
    ) -> List[AccessAuditLog]:
        """Get user's access history"""
        result = await db.execute(
            select(AccessAuditLog)
            .where(AccessAuditLog.user_id == user_id)
            .order_by(AccessAuditLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_tenant_audit_logs(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        limit: int = 100
    ) -> List[AccessAuditLog]:
        """Get tenant's audit logs"""
        result = await db.execute(
            select(AccessAuditLog)
            .where(AccessAuditLog.tenant_id == tenant_id)
            .order_by(AccessAuditLog.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def _log_permission_change(
        self,
        db: AsyncSession,
        document_id: UUID,
        user_id: UUID,
        action: str,
        details: Dict[str, Any]
    ):
        """Log permission change"""
        await self.log_access(
            db,
            document_id=document_id,
            user_id=user_id,
            action=action,
            details=details
        )
    
    def _generate_share_link(self) -> str:
        """Generate unique share link"""
        return f"share_{secrets.token_urlsafe(32)}"
    
    def _generate_external_token(self) -> str:
        """Generate secure external access token"""
        return f"ext_{secrets.token_urlsafe(48)}"