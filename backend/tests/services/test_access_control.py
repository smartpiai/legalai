"""
Tests for Access Control Service
Following TDD approach - tests written first
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.document import Document
from app.models.tenant import Tenant
from app.services.access_control import AccessControlService
from app.schemas.access_control import (
    AccessPermission,
    AccessLevel,
    ShareRequest,
    AccessAuditLog,
    PermissionInheritance
)


@pytest.fixture
async def access_service():
    """Create access control service instance"""
    return AccessControlService()


@pytest.fixture
async def test_users(db_session: AsyncSession):
    """Create test users"""
    tenant = Tenant(
        id=uuid4(),
        name="Test Tenant",
        domain="test.com"
    )
    db_session.add(tenant)
    
    owner = User(
        id=uuid4(),
        email="owner@test.com",
        name="Document Owner",
        tenant_id=tenant.id,
        is_active=True
    )
    
    viewer = User(
        id=uuid4(),
        email="viewer@test.com",
        name="Document Viewer",
        tenant_id=tenant.id,
        is_active=True
    )
    
    editor = User(
        id=uuid4(),
        email="editor@test.com",
        name="Document Editor",
        tenant_id=tenant.id,
        is_active=True
    )
    
    external = User(
        id=uuid4(),
        email="external@other.com",
        name="External User",
        tenant_id=uuid4(),  # Different tenant
        is_active=True
    )
    
    db_session.add_all([owner, viewer, editor, external])
    await db_session.commit()
    
    return {
        "tenant": tenant,
        "owner": owner,
        "viewer": viewer,
        "editor": editor,
        "external": external
    }


@pytest.fixture
async def test_document(db_session: AsyncSession, test_users):
    """Create test document"""
    document = Document(
        id=uuid4(),
        title="Test Contract",
        file_name="contract.pdf",
        file_path="contracts/test.pdf",
        file_size=1024,
        content_type="application/pdf",
        tenant_id=test_users["tenant"].id,
        created_by=test_users["owner"].id,
        updated_by=test_users["owner"].id
    )
    db_session.add(document)
    await db_session.commit()
    return document


class TestDocumentLevelPermissions:
    """Test document-level access control"""
    
    async def test_grant_document_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test granting access to a document"""
        # Grant view access to viewer
        permission = await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id
        )
        
        assert permission is not None
        assert permission.document_id == test_document.id
        assert permission.user_id == test_users["viewer"].id
        assert permission.access_level == AccessLevel.VIEW
        assert permission.granted_by == test_users["owner"].id
    
    async def test_check_document_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test checking if user has access to document"""
        # Grant access first
        await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id
        )
        
        # Check access
        has_access = await access_service.check_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.VIEW
        )
        
        assert has_access is True
        
        # Check for higher permission level
        has_edit_access = await access_service.check_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.EDIT
        )
        
        assert has_edit_access is False
    
    async def test_revoke_document_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test revoking access to a document"""
        # Grant access first
        await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id
        )
        
        # Revoke access
        revoked = await access_service.revoke_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            revoked_by=test_users["owner"].id
        )
        
        assert revoked is True
        
        # Check access is revoked
        has_access = await access_service.check_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.VIEW
        )
        
        assert has_access is False
    
    async def test_list_document_permissions(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test listing all permissions for a document"""
        # Grant multiple permissions
        await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id
        )
        
        await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["editor"].id,
            access_level=AccessLevel.EDIT,
            granted_by=test_users["owner"].id
        )
        
        # List permissions
        permissions = await access_service.list_document_permissions(
            db_session,
            document_id=test_document.id
        )
        
        assert len(permissions) == 3  # Owner + 2 granted
        user_ids = [p.user_id for p in permissions]
        assert test_users["owner"].id in user_ids
        assert test_users["viewer"].id in user_ids
        assert test_users["editor"].id in user_ids
    
    async def test_owner_has_full_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test that document owner always has full access"""
        # Check owner has all access levels
        for level in [AccessLevel.VIEW, AccessLevel.EDIT, AccessLevel.DELETE, AccessLevel.SHARE]:
            has_access = await access_service.check_access(
                db_session,
                document_id=test_document.id,
                user_id=test_users["owner"].id,
                required_level=level
            )
            assert has_access is True


class TestFolderHierarchyPermissions:
    """Test folder hierarchy and permission inheritance"""
    
    async def test_create_folder_with_permissions(
        self, db_session: AsyncSession, access_service, test_users
    ):
        """Test creating a folder with permissions"""
        folder = await access_service.create_folder(
            db_session,
            name="Legal Documents",
            parent_id=None,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        assert folder is not None
        assert folder.name == "Legal Documents"
        assert folder.parent_id is None
        assert folder.created_by == test_users["owner"].id
    
    async def test_folder_permission_inheritance(
        self, db_session: AsyncSession, access_service, test_users
    ):
        """Test that folder permissions are inherited by documents"""
        # Create folder
        folder = await access_service.create_folder(
            db_session,
            name="Contracts",
            parent_id=None,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        # Grant folder access to viewer
        await access_service.grant_folder_access(
            db_session,
            folder_id=folder.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id,
            inherit=True
        )
        
        # Create document in folder
        document = Document(
            id=uuid4(),
            title="Inherited Doc",
            file_name="doc.pdf",
            file_path="contracts/doc.pdf",
            file_size=512,
            content_type="application/pdf",
            folder_id=folder.id,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        db_session.add(document)
        await db_session.commit()
        
        # Check viewer has inherited access
        has_access = await access_service.check_access(
            db_session,
            document_id=document.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.VIEW
        )
        
        assert has_access is True
    
    async def test_nested_folder_inheritance(
        self, db_session: AsyncSession, access_service, test_users
    ):
        """Test permission inheritance in nested folders"""
        # Create parent folder
        parent = await access_service.create_folder(
            db_session,
            name="Legal",
            parent_id=None,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        # Create child folder
        child = await access_service.create_folder(
            db_session,
            name="Contracts",
            parent_id=parent.id,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        # Grant access to parent folder
        await access_service.grant_folder_access(
            db_session,
            folder_id=parent.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id,
            inherit=True
        )
        
        # Check access to child folder
        has_access = await access_service.check_folder_access(
            db_session,
            folder_id=child.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.VIEW
        )
        
        assert has_access is True


class TestSharingCapabilities:
    """Test document sharing functionality"""
    
    async def test_share_document_internal(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test sharing document with internal user"""
        share_request = ShareRequest(
            document_id=test_document.id,
            recipient_email=test_users["viewer"].email,
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() + timedelta(days=30),
            message="Please review this contract"
        )
        
        share_result = await access_service.share_document(
            db_session,
            request=share_request,
            shared_by=test_users["owner"].id
        )
        
        assert share_result.success is True
        assert share_result.share_link is not None
        assert share_result.recipient_id == test_users["viewer"].id
    
    async def test_share_document_external(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test sharing document with external user"""
        share_request = ShareRequest(
            document_id=test_document.id,
            recipient_email="external@company.com",
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() + timedelta(days=7),
            message="Contract for review"
        )
        
        share_result = await access_service.share_document(
            db_session,
            request=share_request,
            shared_by=test_users["owner"].id
        )
        
        assert share_result.success is True
        assert share_result.share_link is not None
        assert share_result.is_external is True
        assert share_result.expires_at is not None
    
    async def test_share_link_expiration(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test that share links expire correctly"""
        # Create expired share
        share_request = ShareRequest(
            document_id=test_document.id,
            recipient_email=test_users["viewer"].email,
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() - timedelta(hours=1),  # Already expired
            message="Expired share"
        )
        
        share_result = await access_service.share_document(
            db_session,
            request=share_request,
            shared_by=test_users["owner"].id
        )
        
        # Try to access with expired link
        has_access = await access_service.check_share_link_access(
            db_session,
            share_link=share_result.share_link,
            user_id=test_users["viewer"].id
        )
        
        assert has_access is False
    
    async def test_revoke_share_link(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test revoking a share link"""
        # Create share
        share_request = ShareRequest(
            document_id=test_document.id,
            recipient_email=test_users["viewer"].email,
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        
        share_result = await access_service.share_document(
            db_session,
            request=share_request,
            shared_by=test_users["owner"].id
        )
        
        # Revoke share
        revoked = await access_service.revoke_share(
            db_session,
            share_id=share_result.share_id,
            revoked_by=test_users["owner"].id
        )
        
        assert revoked is True
        
        # Check access is revoked
        has_access = await access_service.check_share_link_access(
            db_session,
            share_link=share_result.share_link,
            user_id=test_users["viewer"].id
        )
        
        assert has_access is False


class TestAccessAuditLogging:
    """Test access audit logging functionality"""
    
    async def test_log_document_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test logging document access"""
        # Log access event
        await access_service.log_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            action="VIEW",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )
        
        # Get audit logs
        logs = await access_service.get_document_audit_logs(
            db_session,
            document_id=test_document.id
        )
        
        assert len(logs) > 0
        latest_log = logs[0]
        assert latest_log.document_id == test_document.id
        assert latest_log.user_id == test_users["viewer"].id
        assert latest_log.action == "VIEW"
        assert latest_log.ip_address == "192.168.1.1"
    
    async def test_log_permission_changes(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test logging permission changes"""
        # Grant access (should log)
        await access_service.grant_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id
        )
        
        # Get audit logs
        logs = await access_service.get_document_audit_logs(
            db_session,
            document_id=test_document.id
        )
        
        grant_logs = [l for l in logs if l.action == "GRANT_ACCESS"]
        assert len(grant_logs) > 0
        assert grant_logs[0].details["granted_to"] == str(test_users["viewer"].id)
        assert grant_logs[0].details["access_level"] == "VIEW"
    
    async def test_get_user_access_history(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test getting user's access history"""
        # Log multiple access events
        for action in ["VIEW", "DOWNLOAD", "EDIT"]:
            await access_service.log_access(
                db_session,
                document_id=test_document.id,
                user_id=test_users["viewer"].id,
                action=action
            )
        
        # Get user's history
        history = await access_service.get_user_access_history(
            db_session,
            user_id=test_users["viewer"].id,
            limit=10
        )
        
        assert len(history) >= 3
        actions = [h.action for h in history]
        assert "VIEW" in actions
        assert "DOWNLOAD" in actions
        assert "EDIT" in actions


class TestPermissionInheritanceRules:
    """Test permission inheritance rules"""
    
    async def test_inheritance_override(
        self, db_session: AsyncSession, access_service, test_users
    ):
        """Test that direct permissions override inherited ones"""
        # Create folder
        folder = await access_service.create_folder(
            db_session,
            name="Contracts",
            parent_id=None,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        # Grant VIEW to folder
        await access_service.grant_folder_access(
            db_session,
            folder_id=folder.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id,
            inherit=True
        )
        
        # Create document in folder
        document = Document(
            id=uuid4(),
            title="Override Doc",
            file_name="doc.pdf",
            file_path="contracts/doc.pdf",
            file_size=512,
            content_type="application/pdf",
            folder_id=folder.id,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        db_session.add(document)
        await db_session.commit()
        
        # Grant EDIT directly to document (overrides folder VIEW)
        await access_service.grant_access(
            db_session,
            document_id=document.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.EDIT,
            granted_by=test_users["owner"].id
        )
        
        # Check has EDIT access (not just VIEW)
        has_edit = await access_service.check_access(
            db_session,
            document_id=document.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.EDIT
        )
        
        assert has_edit is True
    
    async def test_inheritance_blocking(
        self, db_session: AsyncSession, access_service, test_users
    ):
        """Test blocking inheritance at subfolder level"""
        # Create parent folder with inheritance
        parent = await access_service.create_folder(
            db_session,
            name="Parent",
            parent_id=None,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id
        )
        
        # Grant access to parent
        await access_service.grant_folder_access(
            db_session,
            folder_id=parent.id,
            user_id=test_users["viewer"].id,
            access_level=AccessLevel.VIEW,
            granted_by=test_users["owner"].id,
            inherit=True
        )
        
        # Create child folder blocking inheritance
        child = await access_service.create_folder(
            db_session,
            name="Private",
            parent_id=parent.id,
            tenant_id=test_users["tenant"].id,
            created_by=test_users["owner"].id,
            block_inheritance=True
        )
        
        # Check viewer doesn't have access to child
        has_access = await access_service.check_folder_access(
            db_session,
            folder_id=child.id,
            user_id=test_users["viewer"].id,
            required_level=AccessLevel.VIEW
        )
        
        assert has_access is False


class TestExternalUserAccess:
    """Test external user access management"""
    
    async def test_grant_external_access(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test granting access to external user"""
        # Create external access
        external_access = await access_service.grant_external_access(
            db_session,
            document_id=test_document.id,
            email="external@company.com",
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() + timedelta(days=7),
            granted_by=test_users["owner"].id
        )
        
        assert external_access is not None
        assert external_access.email == "external@company.com"
        assert external_access.access_token is not None
        assert external_access.expires_at is not None
    
    async def test_validate_external_access_token(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test validating external access token"""
        # Create external access
        external_access = await access_service.grant_external_access(
            db_session,
            document_id=test_document.id,
            email="external@company.com",
            access_level=AccessLevel.VIEW,
            expires_at=datetime.utcnow() + timedelta(days=7),
            granted_by=test_users["owner"].id
        )
        
        # Validate token
        is_valid = await access_service.validate_external_token(
            db_session,
            token=external_access.access_token,
            document_id=test_document.id
        )
        
        assert is_valid is True
        
        # Invalid token
        is_valid = await access_service.validate_external_token(
            db_session,
            token="invalid_token",
            document_id=test_document.id
        )
        
        assert is_valid is False
    
    async def test_list_external_accesses(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test listing external accesses for a document"""
        # Grant multiple external accesses
        emails = ["external1@company.com", "external2@company.com"]
        for email in emails:
            await access_service.grant_external_access(
                db_session,
                document_id=test_document.id,
                email=email,
                access_level=AccessLevel.VIEW,
                expires_at=datetime.utcnow() + timedelta(days=7),
                granted_by=test_users["owner"].id
            )
        
        # List external accesses
        external_list = await access_service.list_external_accesses(
            db_session,
            document_id=test_document.id
        )
        
        assert len(external_list) == 2
        external_emails = [e.email for e in external_list]
        assert "external1@company.com" in external_emails
        assert "external2@company.com" in external_emails


class TestTenantIsolation:
    """Test multi-tenant isolation in access control"""
    
    async def test_cross_tenant_access_denied(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test that users from different tenants cannot access documents"""
        # Try to grant access to user from different tenant
        with pytest.raises(PermissionError, match="cross-tenant"):
            await access_service.grant_access(
                db_session,
                document_id=test_document.id,
                user_id=test_users["external"].id,  # Different tenant
                access_level=AccessLevel.VIEW,
                granted_by=test_users["owner"].id
            )
    
    async def test_tenant_isolation_in_audit_logs(
        self, db_session: AsyncSession, access_service, test_users, test_document
    ):
        """Test that audit logs are tenant-isolated"""
        # Create another tenant's document
        other_document = Document(
            id=uuid4(),
            title="Other Tenant Doc",
            file_name="other.pdf",
            file_path="other/doc.pdf",
            file_size=512,
            content_type="application/pdf",
            tenant_id=uuid4(),  # Different tenant
            created_by=uuid4()
        )
        db_session.add(other_document)
        await db_session.commit()
        
        # Log access for both documents
        await access_service.log_access(
            db_session,
            document_id=test_document.id,
            user_id=test_users["viewer"].id,
            action="VIEW"
        )
        
        await access_service.log_access(
            db_session,
            document_id=other_document.id,
            user_id=uuid4(),
            action="VIEW"
        )
        
        # Get logs should only return same tenant
        logs = await access_service.get_tenant_audit_logs(
            db_session,
            tenant_id=test_users["tenant"].id
        )
        
        document_ids = [l.document_id for l in logs]
        assert test_document.id in document_ids
        assert other_document.id not in document_ids