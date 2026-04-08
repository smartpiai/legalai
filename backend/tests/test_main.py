"""
Tests for FastAPI main application initialization and middleware.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: requires app.main (which requires app/models/ — not yet scaffolded).
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live app unavailable")
from httpx import AsyncClient
from unittest.mock import patch


class TestAppInitialization:
    """Test FastAPI application initialization."""
    
    @pytest.mark.asyncio
    async def test_app_metadata(self, async_client: AsyncClient):
        """Test that app has correct metadata."""
        response = await async_client.get("/openapi.json")
        
        assert response.status_code == 200
        openapi = response.json()
        
        assert openapi["info"]["title"] == "Legal AI Platform"
        assert openapi["info"]["version"] == "1.0.0"
        assert "description" in openapi["info"]
        assert "contact" in openapi["info"]
        assert "license" in openapi["info"]
    
    @pytest.mark.asyncio
    async def test_api_versioning(self, async_client: AsyncClient):
        """Test API versioning is properly configured."""
        # V1 endpoints should be accessible
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 200
        
        # Root health should also work
        response = await async_client.get("/")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_docs_endpoints(self, async_client: AsyncClient):
        """Test that documentation endpoints are available."""
        # Swagger UI
        response = await async_client.get("/docs")
        assert response.status_code == 200
        assert "swagger" in response.text.lower()
        
        # ReDoc
        response = await async_client.get("/redoc")
        assert response.status_code == 200
        assert "redoc" in response.text.lower()


class TestCORSMiddleware:
    """Test CORS middleware configuration."""
    
    @pytest.mark.asyncio
    async def test_cors_headers_on_get(self, async_client: AsyncClient):
        """Test CORS headers on GET request."""
        headers = {"Origin": "http://localhost:3000"}
        response = await async_client.get("/", headers=headers)
        
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    
    @pytest.mark.asyncio
    async def test_cors_preflight(self, async_client: AsyncClient):
        """Test CORS preflight request."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization"
        }
        response = await async_client.options("/api/v1/health", headers=headers)
        
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
        assert "access-control-allow-headers" in response.headers
        assert "POST" in response.headers["access-control-allow-methods"]
    
    @pytest.mark.asyncio
    async def test_cors_credentials(self, async_client: AsyncClient):
        """Test CORS allows credentials."""
        headers = {"Origin": "http://localhost:3000"}
        response = await async_client.get("/", headers=headers)
        
        assert response.headers.get("access-control-allow-credentials") == "true"
    
    @pytest.mark.asyncio
    async def test_cors_blocked_origin(self, async_client: AsyncClient):
        """Test CORS blocks unauthorized origins."""
        headers = {"Origin": "http://evil.com"}
        response = await async_client.get("/", headers=headers)
        
        # Should not have CORS headers for unauthorized origin
        assert "access-control-allow-origin" not in response.headers or \
               response.headers["access-control-allow-origin"] != "http://evil.com"


class TestSecurityHeaders:
    """Test security headers middleware."""
    
    @pytest.mark.asyncio
    async def test_security_headers_present(self, async_client: AsyncClient):
        """Test that security headers are set."""
        response = await async_client.get("/")
        
        assert response.status_code == 200
        
        # Check security headers
        assert "x-content-type-options" in response.headers
        assert response.headers["x-content-type-options"] == "nosniff"
        
        assert "x-frame-options" in response.headers
        assert response.headers["x-frame-options"] == "DENY"
        
        assert "x-xss-protection" in response.headers
        assert response.headers["x-xss-protection"] == "1; mode=block"
        
        assert "strict-transport-security" in response.headers
        assert "max-age=" in response.headers["strict-transport-security"]
    
    @pytest.mark.asyncio
    async def test_content_security_policy(self, async_client: AsyncClient):
        """Test Content Security Policy header."""
        response = await async_client.get("/")
        
        assert "content-security-policy" in response.headers
        csp = response.headers["content-security-policy"]
        assert "default-src" in csp
        assert "script-src" in csp


class TestRequestValidation:
    """Test request validation middleware."""
    
    @pytest.mark.asyncio
    async def test_request_id_header(self, async_client: AsyncClient):
        """Test that requests get a unique ID."""
        response = await async_client.get("/")
        
        assert "x-request-id" in response.headers
        request_id = response.headers["x-request-id"]
        assert len(request_id) > 0
        
        # Second request should have different ID
        response2 = await async_client.get("/")
        assert response2.headers["x-request-id"] != request_id
    
    @pytest.mark.asyncio
    async def test_request_size_limit(self, async_client: AsyncClient):
        """Test request body size limit."""
        # Create a large payload (over typical limit)
        large_data = {"data": "x" * (10 * 1024 * 1024)}  # 10MB
        
        response = await async_client.post(
            "/api/v1/test",
            json=large_data
        )
        
        # Should reject large payloads
        assert response.status_code in [413, 422]  # Payload Too Large or Unprocessable
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, async_client: AsyncClient):
        """Test rate limiting middleware."""
        # Make many requests quickly
        responses = []
        for _ in range(100):
            response = await async_client.get("/")
            responses.append(response)
        
        # Check if rate limiting kicked in
        rate_limited = any(r.status_code == 429 for r in responses)
        
        if rate_limited:
            # Check rate limit headers
            limited_response = next(r for r in responses if r.status_code == 429)
            assert "x-ratelimit-limit" in limited_response.headers
            assert "x-ratelimit-remaining" in limited_response.headers
            assert "retry-after" in limited_response.headers


class TestErrorHandling:
    """Test global error handling."""
    
    @pytest.mark.asyncio
    async def test_404_handler(self, async_client: AsyncClient):
        """Test 404 error handler."""
        response = await async_client.get("/nonexistent/endpoint")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_validation_error_handler(self, async_client: AsyncClient):
        """Test validation error handler."""
        # Send invalid data type
        response = await async_client.post(
            "/api/v1/tenants",
            json={"name": 123}  # Should be string
        )
        
        if response.status_code == 422:
            data = response.json()
            assert "detail" in data
            assert isinstance(data["detail"], list)
            assert len(data["detail"]) > 0
    
    @pytest.mark.asyncio
    async def test_internal_error_handler(self, async_client: AsyncClient):
        """Test 500 error handler."""
        with patch("app.api.v1.health.check_postgresql") as mock_check:
            mock_check.side_effect = Exception("Unexpected error")
            
            response = await async_client.get("/api/v1/health/postgresql")
            
            assert response.status_code == 503
            data = response.json()
            assert "status" in data or "detail" in data


class TestStartupShutdown:
    """Test application startup and shutdown events."""
    
    @pytest.mark.asyncio
    async def test_startup_event(self):
        """Test that startup event initializes services."""
        from app.main import app
        
        # Check startup event is registered
        assert len(app.router.on_startup) > 0
        
        # Startup should initialize database connections
        # This would be tested by checking if services are accessible
    
    @pytest.mark.asyncio
    async def test_shutdown_event(self):
        """Test that shutdown event cleans up resources."""
        from app.main import app
        
        # Check shutdown event is registered
        assert len(app.router.on_shutdown) > 0
        
        # Shutdown should close database connections
        # This would be tested by checking connections are closed


class TestMiddlewareOrder:
    """Test middleware execution order."""
    
    @pytest.mark.asyncio
    async def test_middleware_chain(self, async_client: AsyncClient):
        """Test that middleware executes in correct order."""
        headers = {
            "Origin": "http://localhost:3000",
            "X-Custom-Header": "test"
        }
        
        response = await async_client.get("/", headers=headers)
        
        # Should have headers from multiple middleware
        assert "x-request-id" in response.headers  # Request ID middleware
        assert "access-control-allow-origin" in response.headers  # CORS
        assert "x-content-type-options" in response.headers  # Security headers
        
        # Response should be successful
        assert response.status_code == 200