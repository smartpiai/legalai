"""
Tests for tenant CRUD endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* and requires live app + database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.tenant import Tenant
from app.models.user import User
from app.core.security import create_access_token


@pytest.fixture
async def superuser_token(test_db_session: AsyncSession):
    """Create a superuser and return auth token."""
    # Create tenant for superuser
    tenant = Tenant(
        name="Admin Tenant",
        slug="admin-tenant",
        is_active=True
    )
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create superuser
    from app.core.security import get_password_hash
    admin = User(
        email="superadmin@example.com",
        username="superadmin",
        hashed_password=get_password_hash("SuperAdmin123!"),
        full_name="Super Admin",
        tenant_id=tenant.id,
        is_active=True,
        is_superuser=True
    )
    test_db_session.add(admin)
    await test_db_session.commit()
    
    # Create token
    token = create_access_token({"sub": admin.email, "tenant_id": tenant.id})
    return token, admin, tenant


@pytest.fixture
async def regular_user_token(test_db_session: AsyncSession):
    """Create a regular user and return auth token."""
    # Create tenant
    tenant = Tenant(
        name="User Tenant", 
        slug="user-tenant",
        is_active=True
    )
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create regular user
    from app.core.security import get_password_hash
    user = User(
        email="regular@example.com",
        username="regularuser",
        hashed_password=get_password_hash("RegularPass123!"),
        full_name="Regular User",
        tenant_id=tenant.id,
        is_active=True,
        is_superuser=False
    )
    test_db_session.add(user)
    await test_db_session.commit()
    
    # Create token
    token = create_access_token({"sub": user.email, "tenant_id": tenant.id})
    return token, user, tenant


class TestTenantList:
    """Test tenant listing endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_tenants_as_superuser(
        self, 
        async_client: AsyncClient, 
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test listing all tenants as superuser."""
        token, admin, admin_tenant = superuser_token
        
        # Create additional tenants
        for i in range(3):
            tenant = Tenant(
                name=f"Test Tenant {i}",
                slug=f"test-tenant-{i}",
                is_active=True
            )
            test_db_session.add(tenant)
        await test_db_session.commit()
        
        response = await async_client.get(
            "/api/v1/tenants",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 4  # Admin tenant + 3 test tenants
    
    @pytest.mark.asyncio
    async def test_list_tenants_pagination(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test tenant listing with pagination."""
        token, admin, tenant = superuser_token
        
        response = await async_client.get(
            "/api/v1/tenants?limit=2&offset=0",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["limit"] == 2
        assert data["offset"] == 0
    
    @pytest.mark.asyncio
    async def test_filter_active_tenants(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test filtering tenants by active status."""
        token, admin, admin_tenant = superuser_token
        
        # Create inactive tenant
        inactive_tenant = Tenant(
            name="Inactive Tenant",
            slug="inactive-tenant",
            is_active=False
        )
        test_db_session.add(inactive_tenant)
        await test_db_session.commit()
        
        response = await async_client.get(
            "/api/v1/tenants?is_active=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        for tenant in data["items"]:
            assert tenant["is_active"] is True
    
    @pytest.mark.asyncio
    async def test_search_tenants(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test searching tenants by name or slug."""
        token, admin, tenant = superuser_token
        
        response = await async_client.get(
            "/api/v1/tenants?search=admin",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any(
            "admin" in t["name"].lower() or "admin" in t["slug"].lower()
            for t in data["items"]
        )
    
    @pytest.mark.asyncio
    async def test_regular_user_cannot_list_all_tenants(
        self,
        async_client: AsyncClient,
        regular_user_token
    ):
        """Test that regular users cannot list all tenants."""
        token, user, tenant = regular_user_token
        
        response = await async_client.get(
            "/api/v1/tenants",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestTenantGet:
    """Test getting individual tenants."""
    
    @pytest.mark.asyncio
    async def test_get_tenant_by_id(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test getting a specific tenant by ID."""
        token, admin, tenant = superuser_token
        
        response = await async_client.get(
            f"/api/v1/tenants/{tenant.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == tenant.id
        assert data["name"] == tenant.name
        assert data["slug"] == tenant.slug
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_tenant(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test getting a tenant that doesn't exist."""
        token, admin, tenant = superuser_token
        
        response = await async_client.get(
            "/api/v1/tenants/99999",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_get_own_tenant(
        self,
        async_client: AsyncClient,
        regular_user_token
    ):
        """Test that regular users can get their own tenant info."""
        token, user, tenant = regular_user_token
        
        response = await async_client.get(
            "/api/v1/tenants/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == tenant.id
        assert data["name"] == tenant.name


class TestTenantCreate:
    """Test tenant creation."""
    
    @pytest.mark.asyncio
    async def test_create_tenant_as_superuser(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test creating a new tenant as superuser."""
        token, admin, admin_tenant = superuser_token
        
        new_tenant_data = {
            "name": "New Corporation",
            "slug": "new-corp",
            "description": "A new corporate tenant",
            "is_active": True,
            "settings": {
                "max_users": 100,
                "max_storage_gb": 500,
                "features": ["contract_management", "ai_analysis"]
            }
        }
        
        response = await async_client.post(
            "/api/v1/tenants",
            json=new_tenant_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == new_tenant_data["name"]
        assert data["slug"] == new_tenant_data["slug"]
        assert data["description"] == new_tenant_data["description"]
        assert data["is_active"] == new_tenant_data["is_active"]
        assert data["settings"] == new_tenant_data["settings"]
        assert "id" in data
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_create_tenant_duplicate_slug(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test that duplicate tenant slugs are rejected."""
        token, admin, existing_tenant = superuser_token
        
        new_tenant_data = {
            "name": "Duplicate Tenant",
            "slug": existing_tenant.slug,  # Use existing slug
            "is_active": True
        }
        
        response = await async_client.post(
            "/api/v1/tenants",
            json=new_tenant_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_create_tenant_invalid_slug(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test that invalid slugs are rejected."""
        token, admin, tenant = superuser_token
        
        new_tenant_data = {
            "name": "Invalid Slug Tenant",
            "slug": "Invalid Slug!",  # Invalid slug with space and special char
            "is_active": True
        }
        
        response = await async_client.post(
            "/api/v1/tenants",
            json=new_tenant_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_regular_user_cannot_create_tenant(
        self,
        async_client: AsyncClient,
        regular_user_token
    ):
        """Test that regular users cannot create tenants."""
        token, user, tenant = regular_user_token
        
        new_tenant_data = {
            "name": "Unauthorized Tenant",
            "slug": "unauthorized",
            "is_active": True
        }
        
        response = await async_client.post(
            "/api/v1/tenants",
            json=new_tenant_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestTenantUpdate:
    """Test tenant updates."""
    
    @pytest.mark.asyncio
    async def test_update_tenant(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test updating a tenant."""
        token, admin, admin_tenant = superuser_token
        
        # Create tenant to update
        tenant = Tenant(
            name="Original Tenant",
            slug="original-tenant",
            is_active=True
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        update_data = {
            "name": "Updated Tenant Name",
            "description": "Updated description",
            "settings": {
                "max_users": 200,
                "features": ["enhanced_ai"]
            }
        }
        
        response = await async_client.patch(
            f"/api/v1/tenants/{tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["settings"] == update_data["settings"]
        assert data["slug"] == tenant.slug  # Slug should not change
    
    @pytest.mark.asyncio
    async def test_deactivate_tenant(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test deactivating a tenant."""
        token, admin, admin_tenant = superuser_token
        
        # Create active tenant
        tenant = Tenant(
            name="Active Tenant",
            slug="active-tenant",
            is_active=True
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        update_data = {"is_active": False}
        
        response = await async_client.patch(
            f"/api/v1/tenants/{tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
    
    @pytest.mark.asyncio
    async def test_cannot_update_tenant_slug(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test that tenant slug cannot be updated."""
        token, admin, admin_tenant = superuser_token
        
        # Create tenant
        tenant = Tenant(
            name="Test Tenant",
            slug="test-tenant",
            is_active=True
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        update_data = {"slug": "new-slug"}
        
        response = await async_client.patch(
            f"/api/v1/tenants/{tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == tenant.slug  # Should remain unchanged
    
    @pytest.mark.asyncio
    async def test_regular_user_cannot_update_tenant(
        self,
        async_client: AsyncClient,
        regular_user_token
    ):
        """Test that regular users cannot update tenants."""
        token, user, tenant = regular_user_token
        
        update_data = {"name": "Hacked Name"}
        
        response = await async_client.patch(
            f"/api/v1/tenants/{tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestTenantDelete:
    """Test tenant deletion."""
    
    @pytest.mark.asyncio
    async def test_delete_tenant(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test deleting (deactivating) a tenant."""
        token, admin, admin_tenant = superuser_token
        
        # Create tenant to delete
        tenant = Tenant(
            name="To Delete",
            slug="to-delete",
            is_active=True
        )
        test_db_session.add(tenant)
        await test_db_session.commit()
        tenant_id = tenant.id
        
        response = await async_client.delete(
            f"/api/v1/tenants/{tenant_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        assert "deactivated" in response.json()["message"].lower()
        
        # Verify tenant is deactivated, not hard deleted
        result = await test_db_session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        deleted_tenant = result.scalar_one()
        assert deleted_tenant.is_active is False
    
    @pytest.mark.asyncio
    async def test_cannot_delete_own_tenant(
        self,
        async_client: AsyncClient,
        superuser_token
    ):
        """Test that superuser cannot delete their own tenant."""
        token, admin, tenant = superuser_token
        
        response = await async_client.delete(
            f"/api/v1/tenants/{tenant.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "cannot delete your own tenant" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_regular_user_cannot_delete_tenant(
        self,
        async_client: AsyncClient,
        regular_user_token,
        test_db_session: AsyncSession
    ):
        """Test that regular users cannot delete tenants."""
        token, user, user_tenant = regular_user_token
        
        # Create another tenant
        other_tenant = Tenant(
            name="Other Tenant",
            slug="other-tenant",
            is_active=True
        )
        test_db_session.add(other_tenant)
        await test_db_session.commit()
        
        response = await async_client.delete(
            f"/api/v1/tenants/{other_tenant.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestTenantStatistics:
    """Test tenant statistics endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_tenant_stats(
        self,
        async_client: AsyncClient,
        superuser_token,
        test_db_session: AsyncSession
    ):
        """Test getting tenant statistics."""
        token, admin, tenant = superuser_token
        
        # Create some users for the tenant
        from app.core.security import get_password_hash
        for i in range(5):
            user = User(
                email=f"user{i}@tenant.com",
                username=f"user{i}",
                hashed_password=get_password_hash("Pass123!"),
                tenant_id=tenant.id,
                is_active=True
            )
            test_db_session.add(user)
        await test_db_session.commit()
        
        response = await async_client.get(
            f"/api/v1/tenants/{tenant.id}/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user_count" in data
        assert "contract_count" in data
        assert "storage_used_gb" in data
        assert data["user_count"] >= 5
    
    @pytest.mark.asyncio
    async def test_regular_user_can_get_own_tenant_stats(
        self,
        async_client: AsyncClient,
        regular_user_token
    ):
        """Test that users can get their own tenant's statistics."""
        token, user, tenant = regular_user_token
        
        response = await async_client.get(
            "/api/v1/tenants/me/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "user_count" in data
        assert "contract_count" in data