"""
Comprehensive tests for refresh token implementation.
Following TDD - RED phase: Writing comprehensive tests first.
"""
import pytest

# S3-005: imports app.models.* and requires live app + database.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live database required")
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch, MagicMock
import jwt

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.models.user import User
from app.models.refresh_token import RefreshToken


@pytest.mark.asyncio
class TestRefreshTokenEndpoint:
    """Test suite for refresh token functionality."""
    
    async def test_refresh_token_success(self, async_client: AsyncClient, test_user: User):
        """Test successful token refresh."""
        # Create initial tokens
        refresh_token = create_refresh_token(
            data={"sub": test_user.email, "tenant_id": test_user.tenant_id}
        )
        
        # Request new tokens
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        
        # Verify new tokens are different
        assert data["refresh_token"] != refresh_token
    
    async def test_refresh_token_stores_in_database(
        self, 
        async_client: AsyncClient, 
        test_user: User,
        db_session: AsyncSession
    ):
        """Test that refresh tokens are stored in database."""
        # Login to get tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        data = response.json()
        refresh_token = data["refresh_token"]
        
        # Check token is stored in database
        from sqlalchemy import select
        result = await db_session.execute(
            select(RefreshToken).where(RefreshToken.user_id == test_user.id)
        )
        stored_token = result.scalar_one_or_none()
        
        assert stored_token is not None
        assert stored_token.is_active == True
        assert stored_token.expires_at > datetime.utcnow()
    
    async def test_refresh_token_invalidates_old_token(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test that old refresh token is invalidated after use."""
        # Get initial tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        initial_refresh = response.json()["refresh_token"]
        
        # Use refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_refresh}
        )
        
        assert response.status_code == 200
        
        # Try to use old token again
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_refresh}
        )
        
        assert response.status_code == 401
        assert "Token has been revoked" in response.json()["detail"]
    
    async def test_refresh_token_with_expired_token(self, async_client: AsyncClient, test_user: User):
        """Test refresh with expired refresh token."""
        # Create expired refresh token
        expired_token = create_refresh_token(
            data={"sub": test_user.email, "tenant_id": test_user.tenant_id}
        )
        
        # Mock time to make token expired
        with patch('app.core.security.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime.utcnow() + timedelta(days=31)
            
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": expired_token}
            )
            
            assert response.status_code == 401
            assert "Token has expired" in response.json()["detail"]
    
    async def test_refresh_token_with_invalid_token(self, async_client: AsyncClient):
        """Test refresh with invalid token format."""
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.format"}
        )
        
        assert response.status_code == 401
        assert "Invalid token" in response.json()["detail"]
    
    async def test_refresh_token_for_inactive_user(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test refresh token for deactivated user."""
        # Create refresh token
        refresh_token = create_refresh_token(
            data={"sub": test_user.email, "tenant_id": test_user.tenant_id}
        )
        
        # Deactivate user
        test_user.is_active = False
        await db_session.commit()
        
        # Try to refresh
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 401
        assert "User account is inactive" in response.json()["detail"]
    
    async def test_refresh_token_rotation(self, async_client: AsyncClient, test_user: User):
        """Test that refresh tokens are rotated on each use."""
        # Get initial tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        tokens = [response.json()["refresh_token"]]
        
        # Rotate tokens multiple times
        for _ in range(3):
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": tokens[-1]}
            )
            
            assert response.status_code == 200
            new_token = response.json()["refresh_token"]
            assert new_token not in tokens
            tokens.append(new_token)
        
        # All tokens should be unique
        assert len(tokens) == len(set(tokens))
    
    async def test_refresh_token_family_detection(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test detection of refresh token reuse (possible token theft)."""
        # Get initial tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        initial_refresh = response.json()["refresh_token"]
        
        # Use token once (legitimate use)
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_refresh}
        )
        
        assert response.status_code == 200
        new_refresh = response.json()["refresh_token"]
        
        # Attempt to reuse old token (possible theft detection)
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_refresh}
        )
        
        assert response.status_code == 401
        
        # All tokens in family should be invalidated
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": new_refresh}
        )
        
        assert response.status_code == 401
        assert "Token family has been invalidated" in response.json()["detail"]
    
    async def test_refresh_token_with_device_tracking(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test refresh token tracks device information."""
        # Login with device info
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"},
            headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"}
        )
        
        refresh_token = response.json()["refresh_token"]
        
        # Check device info is stored
        from sqlalchemy import select
        result = await db_session.execute(
            select(RefreshToken).where(RefreshToken.user_id == test_user.id)
        )
        stored_token = result.scalar_one_or_none()
        
        assert stored_token is not None
        assert "iPhone" in stored_token.device_info
        assert stored_token.ip_address is not None
    
    async def test_refresh_token_rate_limiting(self, async_client: AsyncClient, test_user: User):
        """Test rate limiting on refresh endpoint."""
        refresh_token = create_refresh_token(
            data={"sub": test_user.email, "tenant_id": test_user.tenant_id}
        )
        
        # Make multiple rapid requests
        responses = []
        for _ in range(10):
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token}
            )
            responses.append(response.status_code)
        
        # Should get rate limited
        assert 429 in responses  # Too Many Requests
    
    async def test_concurrent_refresh_token_requests(
        self,
        async_client: AsyncClient,
        test_user: User
    ):
        """Test handling of concurrent refresh requests with same token."""
        import asyncio
        
        # Get initial token
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        refresh_token = response.json()["refresh_token"]
        
        # Make concurrent requests
        async def refresh():
            return await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token}
            )
        
        results = await asyncio.gather(
            refresh(), refresh(), refresh(),
            return_exceptions=True
        )
        
        # Only one should succeed
        success_count = sum(1 for r in results if not isinstance(r, Exception) and r.status_code == 200)
        assert success_count == 1
    
    async def test_refresh_token_with_scope_changes(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test refresh token preserves but can update scopes."""
        # Create token with specific scopes
        refresh_token = create_refresh_token(
            data={
                "sub": test_user.email,
                "tenant_id": test_user.tenant_id,
                "scopes": ["read:contracts", "write:contracts"]
            }
        )
        
        # Refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        
        # Decode new access token to check scopes
        access_token = response.json()["access_token"]
        payload = jwt.decode(access_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        
        assert "read:contracts" in payload.get("scopes", [])
        assert "write:contracts" in payload.get("scopes", [])
    
    async def test_refresh_token_logout_invalidates_tokens(
        self,
        async_client: AsyncClient,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test that logout invalidates all refresh tokens for user."""
        # Login to get tokens
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "testpassword"}
        )
        
        access_token = response.json()["access_token"]
        refresh_token = response.json()["refresh_token"]
        
        # Logout
        response = await async_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        
        # Try to use refresh token
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 401
        assert "Token has been revoked" in response.json()["detail"]
    
    async def test_refresh_token_max_lifetime(
        self,
        async_client: AsyncClient,
        test_user: User
    ):
        """Test refresh tokens have maximum lifetime regardless of rotation."""
        # Create token with metadata about first issuance
        refresh_token = create_refresh_token(
            data={
                "sub": test_user.email,
                "tenant_id": test_user.tenant_id,
                "family_id": "test-family-123",
                "issued_at": datetime.utcnow().isoformat()
            }
        )
        
        # Mock time to near max lifetime
        with patch('app.core.security.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime.utcnow() + timedelta(days=89)
            
            # Should still work
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": refresh_token}
            )
            
            assert response.status_code == 200
            
            # Mock time past max lifetime
            mock_datetime.utcnow.return_value = datetime.utcnow() + timedelta(days=91)
            
            new_token = response.json()["refresh_token"]
            response = await async_client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": new_token}
            )
            
            assert response.status_code == 401
            assert "Maximum token lifetime exceeded" in response.json()["detail"]


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
    user = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        hashed_password=get_password_hash("testpassword"),
        is_active=True,
        is_superuser=False,
        tenant_id="test-tenant-123",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    return user


@pytest.fixture
async def async_client():
    """Create async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client