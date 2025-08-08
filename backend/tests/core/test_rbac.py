"""
Tests for RBAC (Role-Based Access Control) middleware and permission checking.
Following TDD methodology - tests written before implementation.
"""
import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.tenant import Tenant
from app.models.role import Role, Permission
from app.core.rbac import (
    require_permission,
    require_any_permission,
    require_all_permissions,
    check_user_permission,
    get_user_permissions
)
from app.api.v1.auth import get_current_user
from app.core.security import create_access_token


@pytest.fixture
async def setup_rbac_data(test_db_session: AsyncSession):
    """Set up test data for RBAC tests."""
    # Create tenant
    tenant = Tenant(
        name="Test Corp",
        slug="test-corp",
        is_active=True
    )
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create permissions
    permissions = {
        'contracts.read': Permission(
            name="contracts.read",
            description="Read contracts",
            resource="contracts",
            action="read"
        ),
        'contracts.write': Permission(
            name="contracts.write",
            description="Write contracts",
            resource="contracts",
            action="write"
        ),
        'contracts.delete': Permission(
            name="contracts.delete",
            description="Delete contracts",
            resource="contracts",
            action="delete"
        ),
        'users.manage': Permission(
            name="users.manage",
            description="Manage users",
            resource="users",
            action="manage"
        ),
    }
    
    for perm in permissions.values():
        test_db_session.add(perm)
    await test_db_session.commit()
    
    # Create roles
    viewer_role = Role(
        name="Viewer",
        slug="viewer",
        tenant_id=tenant.id
    )
    editor_role = Role(
        name="Editor", 
        slug="editor",
        tenant_id=tenant.id
    )
    admin_role = Role(
        name="Admin",
        slug="admin",
        tenant_id=tenant.id
    )
    
    test_db_session.add(viewer_role)
    test_db_session.add(editor_role)
    test_db_session.add(admin_role)
    await test_db_session.commit()
    
    # Assign permissions to roles
    viewer_role.permissions = [permissions['contracts.read']]
    editor_role.permissions = [
        permissions['contracts.read'],
        permissions['contracts.write']
    ]
    admin_role.permissions = list(permissions.values())  # All permissions
    
    # Create users with different roles
    from app.core.security import get_password_hash
    
    viewer_user = User(
        email="viewer@test.com",
        username="viewer",
        hashed_password=get_password_hash("ViewerPass123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    editor_user = User(
        email="editor@test.com",
        username="editor",
        hashed_password=get_password_hash("EditorPass123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    admin_user = User(
        email="admin@test.com",
        username="admin",
        hashed_password=get_password_hash("AdminPass123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    no_role_user = User(
        email="norole@test.com",
        username="norole",
        hashed_password=get_password_hash("NoRolePass123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    
    test_db_session.add(viewer_user)
    test_db_session.add(editor_user)
    test_db_session.add(admin_user)
    test_db_session.add(no_role_user)
    await test_db_session.commit()
    
    # Assign roles to users
    viewer_user.roles = [viewer_role]
    editor_user.roles = [editor_role]
    admin_user.roles = [admin_role]
    # no_role_user has no roles
    
    await test_db_session.commit()
    
    return {
        'tenant': tenant,
        'permissions': permissions,
        'roles': {
            'viewer': viewer_role,
            'editor': editor_role,
            'admin': admin_role
        },
        'users': {
            'viewer': viewer_user,
            'editor': editor_user,
            'admin': admin_user,
            'no_role': no_role_user
        }
    }


class TestPermissionChecking:
    """Test permission checking functions."""
    
    @pytest.mark.asyncio
    async def test_get_user_permissions(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test getting all permissions for a user."""
        data = setup_rbac_data
        editor_user = data['users']['editor']
        
        permissions = await get_user_permissions(editor_user, test_db_session)
        
        assert len(permissions) == 2
        perm_names = [p.name for p in permissions]
        assert 'contracts.read' in perm_names
        assert 'contracts.write' in perm_names
        assert 'contracts.delete' not in perm_names
    
    @pytest.mark.asyncio
    async def test_check_user_permission_exists(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test checking if user has a specific permission."""
        data = setup_rbac_data
        editor_user = data['users']['editor']
        
        # Should have read permission
        has_read = await check_user_permission(
            editor_user,
            'contracts.read',
            test_db_session
        )
        assert has_read is True
        
        # Should have write permission
        has_write = await check_user_permission(
            editor_user,
            'contracts.write',
            test_db_session
        )
        assert has_write is True
        
        # Should NOT have delete permission
        has_delete = await check_user_permission(
            editor_user,
            'contracts.delete',
            test_db_session
        )
        assert has_delete is False
    
    @pytest.mark.asyncio
    async def test_check_user_no_roles(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test that user with no roles has no permissions."""
        data = setup_rbac_data
        no_role_user = data['users']['no_role']
        
        permissions = await get_user_permissions(no_role_user, test_db_session)
        assert len(permissions) == 0
        
        has_read = await check_user_permission(
            no_role_user,
            'contracts.read',
            test_db_session
        )
        assert has_read is False
    
    @pytest.mark.asyncio
    async def test_superuser_bypass(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test that superusers bypass permission checks."""
        data = setup_rbac_data
        
        # Create a superuser with no roles
        from app.core.security import get_password_hash
        superuser = User(
            email="super@test.com",
            username="superuser",
            hashed_password=get_password_hash("SuperPass123!"),
            tenant_id=data['tenant'].id,
            is_active=True,
            is_superuser=True
        )
        test_db_session.add(superuser)
        await test_db_session.commit()
        
        # Superuser should have all permissions even without roles
        has_delete = await check_user_permission(
            superuser,
            'contracts.delete',
            test_db_session
        )
        assert has_delete is True
        
        has_manage = await check_user_permission(
            superuser,
            'users.manage',
            test_db_session
        )
        assert has_manage is True


class TestPermissionDecorators:
    """Test permission requirement decorators for endpoints."""
    
    @pytest.mark.asyncio
    async def test_require_permission_decorator(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test the require_permission decorator."""
        data = setup_rbac_data
        
        # Create a test endpoint with permission requirement
        app = FastAPI()
        
        @app.get("/test-contracts")
        @require_permission("contracts.read")
        async def get_contracts(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(lambda: test_db_session)
        ):
            return {"message": "Success"}
        
        client = TestClient(app)
        
        # Test with viewer (has read permission)
        viewer_token = create_access_token({
            "sub": data['users']['viewer'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.get(
            "/test-contracts",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert response.status_code == 200
        
        # Test with no_role user (no permissions)
        no_role_token = create_access_token({
            "sub": data['users']['no_role'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.get(
            "/test-contracts",
            headers={"Authorization": f"Bearer {no_role_token}"}
        )
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_require_any_permission_decorator(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test the require_any_permission decorator."""
        data = setup_rbac_data
        
        app = FastAPI()
        
        @app.post("/test-contracts")
        @require_any_permission(["contracts.write", "contracts.delete"])
        async def create_contract(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(lambda: test_db_session)
        ):
            return {"message": "Created"}
        
        client = TestClient(app)
        
        # Editor has write permission (one of the required)
        editor_token = create_access_token({
            "sub": data['users']['editor'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.post(
            "/test-contracts",
            headers={"Authorization": f"Bearer {editor_token}"}
        )
        assert response.status_code == 200
        
        # Viewer has neither write nor delete
        viewer_token = create_access_token({
            "sub": data['users']['viewer'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.post(
            "/test-contracts",
            headers={"Authorization": f"Bearer {viewer_token}"}
        )
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_decorator(self, test_db_session: AsyncSession, setup_rbac_data):
        """Test the require_all_permissions decorator."""
        data = setup_rbac_data
        
        app = FastAPI()
        
        @app.delete("/test-contracts")
        @require_all_permissions(["contracts.read", "contracts.write", "contracts.delete"])
        async def delete_contract(
            current_user: User = Depends(get_current_user),
            db: AsyncSession = Depends(lambda: test_db_session)
        ):
            return {"message": "Deleted"}
        
        client = TestClient(app)
        
        # Admin has all permissions
        admin_token = create_access_token({
            "sub": data['users']['admin'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.delete(
            "/test-contracts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Editor has read and write but not delete
        editor_token = create_access_token({
            "sub": data['users']['editor'].email,
            "tenant_id": data['tenant'].id
        })
        response = client.delete(
            "/test-contracts",
            headers={"Authorization": f"Bearer {editor_token}"}
        )
        assert response.status_code == 403


class TestRoleInheritance:
    """Test role inheritance and hierarchical permissions."""
    
    @pytest.mark.asyncio
    async def test_inherited_permissions(self, test_db_session: AsyncSession):
        """Test that child roles inherit parent role permissions."""
        # Create tenant
        tenant = Tenant(name="Test", slug="test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        # Create permissions
        read_perm = Permission(name="read", resource="docs", action="read")
        write_perm = Permission(name="write", resource="docs", action="write")
        delete_perm = Permission(name="delete", resource="docs", action="delete")
        test_db_session.add(read_perm)
        test_db_session.add(write_perm)
        test_db_session.add(delete_perm)
        await test_db_session.commit()
        
        # Create parent role with read permission
        parent_role = Role(
            name="Parent",
            slug="parent",
            tenant_id=tenant.id
        )
        parent_role.permissions = [read_perm]
        test_db_session.add(parent_role)
        await test_db_session.commit()
        
        # Create child role with write permission and parent reference
        child_role = Role(
            name="Child",
            slug="child",
            tenant_id=tenant.id,
            parent_role_id=parent_role.id
        )
        child_role.permissions = [write_perm]
        test_db_session.add(child_role)
        await test_db_session.commit()
        
        # Child should have both read (inherited) and write (own) permissions
        all_perms = child_role.get_all_permissions()
        perm_names = [p.name for p in all_perms]
        assert 'read' in perm_names
        assert 'write' in perm_names
        assert 'delete' not in perm_names


class TestTenantIsolation:
    """Test that RBAC respects tenant boundaries."""
    
    @pytest.mark.asyncio
    async def test_roles_isolated_by_tenant(self, test_db_session: AsyncSession):
        """Test that users can only access roles from their tenant."""
        # Create two tenants
        tenant1 = Tenant(name="Tenant 1", slug="tenant-1", is_active=True)
        tenant2 = Tenant(name="Tenant 2", slug="tenant-2", is_active=True)
        test_db_session.add(tenant1)
        test_db_session.add(tenant2)
        await test_db_session.commit()
        
        # Create same permission
        perm = Permission(name="test.read", resource="test", action="read")
        test_db_session.add(perm)
        await test_db_session.commit()
        
        # Create roles in different tenants
        role1 = Role(name="Role", slug="role", tenant_id=tenant1.id)
        role2 = Role(name="Role", slug="role", tenant_id=tenant2.id)
        role1.permissions = [perm]
        role2.permissions = [perm]
        test_db_session.add(role1)
        test_db_session.add(role2)
        await test_db_session.commit()
        
        # Create users in different tenants
        from app.core.security import get_password_hash
        user1 = User(
            email="user1@test.com",
            username="user1",
            hashed_password=get_password_hash("Pass123!"),
            tenant_id=tenant1.id,
            is_active=True
        )
        user2 = User(
            email="user2@test.com",
            username="user2",
            hashed_password=get_password_hash("Pass123!"),
            tenant_id=tenant2.id,
            is_active=True
        )
        test_db_session.add(user1)
        test_db_session.add(user2)
        await test_db_session.commit()
        
        # Assign roles to users
        user1.roles = [role1]
        user2.roles = [role2]
        await test_db_session.commit()
        
        # Each user should only see their tenant's role
        assert len(user1.roles) == 1
        assert user1.roles[0].tenant_id == tenant1.id
        
        assert len(user2.roles) == 1
        assert user2.roles[0].tenant_id == tenant2.id
        
        # Roles should not be cross-assigned
        assert user1.roles[0].id != user2.roles[0].id