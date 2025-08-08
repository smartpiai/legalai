"""
Tests for user profile CRUD endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import create_access_token


@pytest.fixture
async def test_user_token(test_db_session: AsyncSession):
    """Create a test user and return auth token."""
    # Create tenant
    tenant = Tenant(name="Test Tenant", slug="test-tenant", is_active=True)
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create user
    from app.core.security import get_password_hash
    user = User(
        email="testuser@example.com",
        username="testuser",
        hashed_password=get_password_hash("TestPass123!"),
        full_name="Test User",
        tenant_id=tenant.id,
        is_active=True
    )
    test_db_session.add(user)
    await test_db_session.commit()
    
    # Create token
    token = create_access_token({"sub": user.email, "tenant_id": tenant.id})
    return token, user, tenant


@pytest.fixture
async def admin_user_token(test_db_session: AsyncSession):
    """Create an admin user and return auth token."""
    # Create tenant
    tenant = Tenant(name="Admin Tenant", slug="admin-tenant", is_active=True)
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create admin user
    from app.core.security import get_password_hash
    admin = User(
        email="admin@example.com",
        username="adminuser",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Admin User",
        tenant_id=tenant.id,
        is_active=True,
        is_superuser=True
    )
    test_db_session.add(admin)
    await test_db_session.commit()
    
    # Create token
    token = create_access_token({"sub": admin.email, "tenant_id": tenant.id})
    return token, admin, tenant


class TestUserProfile:
    """Test user profile endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_own_profile(self, async_client: AsyncClient, test_user_token):
        """Test getting own user profile."""
        token, user, tenant = test_user_token
        
        response = await async_client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email
        assert data["username"] == user.username
        assert data["full_name"] == user.full_name
        assert data["tenant_id"] == tenant.id
        assert "hashed_password" not in data
    
    @pytest.mark.asyncio
    async def test_update_own_profile(self, async_client: AsyncClient, test_user_token):
        """Test updating own user profile."""
        token, user, tenant = test_user_token
        
        update_data = {
            "full_name": "Updated Name",
            "username": "newusername"
        }
        
        response = await async_client.patch(
            "/api/v1/users/me",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
        assert data["username"] == "newusername"
        assert data["email"] == user.email  # Email unchanged
    
    @pytest.mark.asyncio
    async def test_cannot_update_email_directly(self, async_client: AsyncClient, test_user_token):
        """Test that email cannot be updated through profile endpoint."""
        token, user, tenant = test_user_token
        
        update_data = {
            "email": "newemail@example.com"
        }
        
        response = await async_client.patch(
            "/api/v1/users/me",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user.email  # Email should remain unchanged
    
    @pytest.mark.asyncio
    async def test_change_password(self, async_client: AsyncClient, test_user_token):
        """Test changing own password."""
        token, user, tenant = test_user_token
        
        password_data = {
            "current_password": "TestPass123!",
            "new_password": "NewSecurePass123!",
            "confirm_password": "NewSecurePass123!"
        }
        
        response = await async_client.post(
            "/api/v1/users/me/password",
            json=password_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Password updated successfully"
        
        # Test login with new password
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "NewSecurePass123!"}
        )
        assert login_response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, async_client: AsyncClient, test_user_token):
        """Test changing password with wrong current password."""
        token, user, tenant = test_user_token
        
        password_data = {
            "current_password": "WrongPassword123!",
            "new_password": "NewSecurePass123!",
            "confirm_password": "NewSecurePass123!"
        }
        
        response = await async_client.post(
            "/api/v1/users/me/password",
            json=password_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_delete_own_account(self, async_client: AsyncClient, test_user_token, test_db_session: AsyncSession):
        """Test user deleting their own account."""
        token, user, tenant = test_user_token
        
        response = await async_client.delete(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "deleted" in data["message"].lower()
        
        # Verify user is deactivated, not hard deleted
        result = await test_db_session.execute(
            select(User).where(User.email == user.email)
        )
        deleted_user = result.scalar_one()
        assert deleted_user.is_active is False


class TestUserManagement:
    """Test user management endpoints (admin only)."""
    
    @pytest.mark.asyncio
    async def test_list_users_as_admin(self, async_client: AsyncClient, admin_user_token, test_db_session: AsyncSession):
        """Test listing all users as admin."""
        token, admin, tenant = admin_user_token
        
        # Create additional users
        from app.core.security import get_password_hash
        for i in range(3):
            user = User(
                email=f"user{i}@example.com",
                username=f"user{i}",
                hashed_password=get_password_hash("Pass123!"),
                tenant_id=tenant.id
            )
            test_db_session.add(user)
        await test_db_session.commit()
        
        response = await async_client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 4  # Admin + 3 users
    
    @pytest.mark.asyncio
    async def test_list_users_pagination(self, async_client: AsyncClient, admin_user_token):
        """Test user listing with pagination."""
        token, admin, tenant = admin_user_token
        
        response = await async_client.get(
            "/api/v1/users?limit=2&offset=0",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 2
        assert "limit" in data
        assert "offset" in data
    
    @pytest.mark.asyncio
    async def test_get_user_by_id(self, async_client: AsyncClient, admin_user_token, test_user_token):
        """Test getting specific user by ID as admin."""
        admin_token, admin, admin_tenant = admin_user_token
        user_token, user, user_tenant = test_user_token
        
        response = await async_client.get(
            f"/api/v1/users/{user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user.id
        assert data["email"] == user.email
    
    @pytest.mark.asyncio
    async def test_regular_user_cannot_list_users(self, async_client: AsyncClient, test_user_token):
        """Test that regular users cannot list all users."""
        token, user, tenant = test_user_token
        
        response = await async_client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
        assert "permission" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_admin_create_user(self, async_client: AsyncClient, admin_user_token):
        """Test admin creating a new user."""
        token, admin, tenant = admin_user_token
        
        new_user_data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "TempPass123!",
            "full_name": "New User",
            "tenant_id": tenant.id,
            "is_active": True
        }
        
        response = await async_client.post(
            "/api/v1/users",
            json=new_user_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == new_user_data["email"]
        assert data["username"] == new_user_data["username"]
        assert "password" not in data
    
    @pytest.mark.asyncio
    async def test_admin_update_user(self, async_client: AsyncClient, admin_user_token, test_user_token):
        """Test admin updating another user."""
        admin_token, admin, admin_tenant = admin_user_token
        user_token, user, user_tenant = test_user_token
        
        update_data = {
            "full_name": "Admin Updated Name",
            "is_active": False
        }
        
        response = await async_client.patch(
            f"/api/v1/users/{user.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Admin Updated Name"
        assert data["is_active"] is False
    
    @pytest.mark.asyncio
    async def test_admin_delete_user(self, async_client: AsyncClient, admin_user_token, test_user_token, test_db_session: AsyncSession):
        """Test admin deleting a user."""
        admin_token, admin, admin_tenant = admin_user_token
        user_token, user, user_tenant = test_user_token
        
        response = await async_client.delete(
            f"/api/v1/users/{user.id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify user is deactivated
        result = await test_db_session.execute(
            select(User).where(User.id == user.id)
        )
        deleted_user = result.scalar_one()
        assert deleted_user.is_active is False


class TestUserFiltering:
    """Test user filtering and search."""
    
    @pytest.mark.asyncio
    async def test_filter_users_by_tenant(self, async_client: AsyncClient, admin_user_token):
        """Test filtering users by tenant ID."""
        token, admin, tenant = admin_user_token
        
        response = await async_client.get(
            f"/api/v1/users?tenant_id={tenant.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        for user in data["items"]:
            assert user["tenant_id"] == tenant.id
    
    @pytest.mark.asyncio
    async def test_search_users(self, async_client: AsyncClient, admin_user_token):
        """Test searching users by email or username."""
        token, admin, tenant = admin_user_token
        
        response = await async_client.get(
            f"/api/v1/users?search=admin",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any("admin" in user["email"].lower() or "admin" in user["username"].lower() 
                  for user in data["items"])
    
    @pytest.mark.asyncio
    async def test_filter_active_users(self, async_client: AsyncClient, admin_user_token):
        """Test filtering by active status."""
        token, admin, tenant = admin_user_token
        
        response = await async_client.get(
            "/api/v1/users?is_active=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        for user in data["items"]:
            assert user["is_active"] is True