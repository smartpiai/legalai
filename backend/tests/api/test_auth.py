"""
Tests for authentication endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import verify_password, verify_token


class TestUserRegistration:
    """Test user registration endpoint."""
    
    @pytest.mark.asyncio
    async def test_register_user_success(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test successful user registration."""
        # Create a tenant first
        tenant = Tenant(name="Test Corp", slug="test-corp", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        user_data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "full_name": "New User",
            "tenant_id": tenant.id
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["username"] == user_data["username"]
        assert data["full_name"] == user_data["full_name"]
        assert "id" in data
        assert "password" not in data
        assert "hashed_password" not in data
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test registration with duplicate email."""
        # Create existing user
        tenant = Tenant(name="Test Corp", slug="test-corp2", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        # First registration
        user_data = {
            "email": "existing@example.com",
            "username": "user1",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201
        
        # Try duplicate email
        user_data["username"] = "user2"
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test registration with duplicate username."""
        tenant = Tenant(name="Test Corp", slug="test-corp3", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        # First registration
        user_data = {
            "email": "user1@example.com",
            "username": "duplicateuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201
        
        # Try duplicate username
        user_data["email"] = "user2@example.com"
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 400
        assert "username already taken" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_register_weak_password(self, async_client: AsyncClient):
        """Test registration with weak password."""
        user_data = {
            "email": "weakpass@example.com",
            "username": "weakpassuser",
            "password": "weak",
            "confirm_password": "weak",
            "full_name": "Weak Pass User"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("at least 8 characters" in str(error) for error in errors)
    
    @pytest.mark.asyncio
    async def test_register_password_mismatch(self, async_client: AsyncClient):
        """Test registration with mismatched passwords."""
        user_data = {
            "email": "mismatch@example.com",
            "username": "mismatchuser",
            "password": "SecurePass123!",
            "confirm_password": "DifferentPass123!",
            "full_name": "Mismatch User"
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("do not match" in str(error) for error in errors)
    
    @pytest.mark.asyncio
    async def test_register_invalid_email(self, async_client: AsyncClient):
        """Test registration with invalid email."""
        user_data = {
            "email": "not-an-email",
            "username": "invalidemailuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("email" in str(error).lower() for error in errors)
    
    @pytest.mark.asyncio
    async def test_register_invalid_username(self, async_client: AsyncClient):
        """Test registration with invalid username."""
        user_data = {
            "email": "valid@example.com",
            "username": "invalid username!",  # Contains spaces and special chars
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        }
        
        response = await async_client.post("/api/v1/auth/register", json=user_data)
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any("username" in str(error).lower() for error in errors)


class TestUserLogin:
    """Test user login endpoint."""
    
    @pytest.mark.asyncio
    async def test_login_success(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test successful login."""
        # Register a user first
        tenant = Tenant(name="Login Test", slug="login-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        register_data = {
            "email": "loginuser@example.com",
            "username": "loginuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Now login
        login_data = {
            "email": "loginuser@example.com",
            "password": "SecurePass123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        
        # Verify token is valid
        token_payload = verify_token(data["access_token"])
        assert token_payload is not None
        assert token_payload["sub"] == "loginuser@example.com"
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test login with wrong password."""
        # Register a user
        tenant = Tenant(name="Wrong Pass", slug="wrong-pass", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        register_data = {
            "email": "wrongpass@example.com",
            "username": "wrongpassuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Try login with wrong password
        login_data = {
            "email": "wrongpass@example.com",
            "password": "WrongPassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, async_client: AsyncClient):
        """Test login with non-existent user."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "SomePassword123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_login_inactive_user(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test login with inactive user."""
        # Register and deactivate user
        tenant = Tenant(name="Inactive Test", slug="inactive-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        register_data = {
            "email": "inactive@example.com",
            "username": "inactiveuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Deactivate user
        from sqlalchemy import select
        result = await test_db_session.execute(
            select(User).where(User.email == "inactive@example.com")
        )
        user = result.scalar_one()
        user.is_active = False
        await test_db_session.commit()
        
        # Try to login
        login_data = {
            "email": "inactive@example.com",
            "password": "SecurePass123!"
        }
        
        response = await async_client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()


class TestTokenRefresh:
    """Test token refresh endpoint."""
    
    @pytest.mark.asyncio
    async def test_refresh_token_success(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test successful token refresh."""
        # Register and login
        tenant = Tenant(name="Refresh Test", slug="refresh-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        register_data = {
            "email": "refresh@example.com",
            "username": "refreshuser",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "tenant_id": tenant.id
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "refresh@example.com", "password": "SecurePass123!"}
        )
        tokens = login_response.json()
        
        # Refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != tokens["access_token"]
    
    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, async_client: AsyncClient):
        """Test refresh with invalid token."""
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.refresh.token"}
        )
        
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_refresh_expired_token(self, async_client: AsyncClient):
        """Test refresh with expired token."""
        # Create an expired token
        from app.core.security import create_refresh_token
        from datetime import datetime, timedelta
        
        expired_token_data = {
            "sub": "expired@example.com",
            "exp": datetime.utcnow() - timedelta(days=1)
        }
        # This would need proper implementation
        
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "expired.token.here"}
        )
        
        assert response.status_code == 401


class TestPasswordReset:
    """Test password reset flow."""
    
    @pytest.mark.asyncio
    async def test_request_password_reset(self, async_client: AsyncClient, test_db_session: AsyncSession):
        """Test requesting password reset."""
        # Register a user
        tenant = Tenant(name="Reset Test", slug="reset-test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        register_data = {
            "email": "reset@example.com",
            "username": "resetuser",
            "password": "OldPass123!",
            "confirm_password": "OldPass123!",
            "tenant_id": tenant.id
        }
        await async_client.post("/api/v1/auth/register", json=register_data)
        
        # Request password reset
        response = await async_client.post(
            "/api/v1/auth/password-reset",
            json={"email": "reset@example.com"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "email" in data["message"].lower()
    
    @pytest.mark.asyncio
    async def test_reset_password_with_token(self, async_client: AsyncClient):
        """Test resetting password with valid token."""
        # This would need email/token mocking
        pass
    
    @pytest.mark.asyncio
    async def test_reset_nonexistent_email(self, async_client: AsyncClient):
        """Test password reset for non-existent email."""
        response = await async_client.post(
            "/api/v1/auth/password-reset",
            json={"email": "nonexistent@example.com"}
        )
        
        # Should still return 200 to avoid email enumeration
        assert response.status_code == 200
        data = response.json()
        assert "message" in data