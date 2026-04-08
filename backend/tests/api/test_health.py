"""
Tests for health check endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: requires app.main via async_client fixture (app/models not scaffolded).
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live app unavailable")

from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


class TestHealthEndpoints:
    """Test health check endpoints for all services."""
    
    @pytest.mark.asyncio
    async def test_root_health_check(self, async_client: AsyncClient):
        """Test root health check endpoint."""
        response = await async_client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "Legal AI Platform"
        assert "version" in data
        assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_detailed_health_check(self, async_client: AsyncClient):
        """Test detailed health check with all service statuses."""
        response = await async_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Overall status
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "timestamp" in data
        assert "uptime" in data
        
        # Service checks
        assert "services" in data
        services = data["services"]
        
        # Check required services
        required_services = [
            "postgresql",
            "redis",
            "neo4j",
            "qdrant",
            "minio"
        ]
        
        for service in required_services:
            assert service in services
            assert services[service]["status"] in ["healthy", "unhealthy"]
            assert "response_time_ms" in services[service]
            if services[service]["status"] == "unhealthy":
                assert "error" in services[service]
    
    @pytest.mark.asyncio
    async def test_liveness_probe(self, async_client: AsyncClient):
        """Test Kubernetes liveness probe endpoint."""
        response = await async_client.get("/health/live")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
        assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_readiness_probe(self, async_client: AsyncClient):
        """Test Kubernetes readiness probe endpoint."""
        response = await async_client.get("/health/ready")
        
        # Could be 200 (ready) or 503 (not ready)
        assert response.status_code in [200, 503]
        data = response.json()
        
        if response.status_code == 200:
            assert data["status"] == "ready"
            assert data["checks"]["database"] is True
            assert data["checks"]["cache"] is True
        else:
            assert data["status"] == "not_ready"
            assert "reason" in data
    
    @pytest.mark.asyncio
    async def test_postgresql_health(self, async_client: AsyncClient):
        """Test PostgreSQL specific health check."""
        response = await async_client.get("/health/postgresql")
        
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert "response_time_ms" in data
        
        if data["status"] == "healthy":
            assert "version" in data
            assert "connection_pool" in data
            assert data["connection_pool"]["size"] >= 0
            assert data["connection_pool"]["available"] >= 0
    
    @pytest.mark.asyncio
    async def test_redis_health(self, async_client: AsyncClient):
        """Test Redis specific health check."""
        response = await async_client.get("/health/redis")
        
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert "response_time_ms" in data
        
        if data["status"] == "healthy":
            assert "version" in data
            assert "used_memory" in data
            assert "connected_clients" in data
    
    @pytest.mark.asyncio
    async def test_neo4j_health(self, async_client: AsyncClient):
        """Test Neo4j specific health check."""
        response = await async_client.get("/health/neo4j")
        
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert "response_time_ms" in data
        
        if data["status"] == "healthy":
            assert "version" in data
            assert "database" in data
    
    @pytest.mark.asyncio
    async def test_qdrant_health(self, async_client: AsyncClient):
        """Test Qdrant specific health check."""
        response = await async_client.get("/health/qdrant")
        
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert "response_time_ms" in data
        
        if data["status"] == "healthy":
            assert "collections_count" in data
    
    @pytest.mark.asyncio
    async def test_minio_health(self, async_client: AsyncClient):
        """Test MinIO specific health check."""
        response = await async_client.get("/health/minio")
        
        assert response.status_code in [200, 503]
        data = response.json()
        
        assert "status" in data
        assert "response_time_ms" in data
        
        if data["status"] == "healthy":
            assert "buckets_count" in data


class TestHealthEndpointFailures:
    """Test health check behavior when services are down."""
    
    @pytest.mark.asyncio
    async def test_health_with_postgresql_down(self, async_client: AsyncClient):
        """Test health check when PostgreSQL is down."""
        with patch("app.core.database.async_engine") as mock_engine:
            mock_engine.connect = AsyncMock(side_effect=Exception("Connection failed"))
            
            response = await async_client.get("/health")
            
            assert response.status_code == 200  # Overall endpoint still works
            data = response.json()
            assert data["status"] in ["degraded", "unhealthy"]
            assert data["services"]["postgresql"]["status"] == "unhealthy"
            assert "Connection failed" in data["services"]["postgresql"]["error"]
    
    @pytest.mark.asyncio
    async def test_health_with_multiple_services_down(self, async_client: AsyncClient):
        """Test health check when multiple services are down."""
        with patch("app.core.database.async_engine") as mock_pg, \
             patch("app.core.cache.get_redis_client") as mock_redis:
            
            mock_pg.connect = AsyncMock(side_effect=Exception("PG failed"))
            mock_redis.return_value.ping = AsyncMock(return_value=False)
            
            response = await async_client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "unhealthy"
            
            # Check multiple services are marked unhealthy
            unhealthy_count = sum(
                1 for service in data["services"].values()
                if service["status"] == "unhealthy"
            )
            assert unhealthy_count >= 2
    
    @pytest.mark.asyncio
    async def test_readiness_with_services_down(self, async_client: AsyncClient):
        """Test readiness probe when critical services are down."""
        with patch("app.core.database.async_engine") as mock_engine:
            mock_engine.connect = AsyncMock(side_effect=Exception("DB unavailable"))
            
            response = await async_client.get("/health/ready")
            
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"
            assert data["checks"]["database"] is False


class TestHealthMetrics:
    """Test health check metrics and monitoring."""
    
    @pytest.mark.asyncio
    async def test_health_metrics_format(self, async_client: AsyncClient):
        """Test that health metrics are in the correct format."""
        response = await async_client.get("/health/metrics")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "system" in data
        assert "cpu_percent" in data["system"]
        assert "memory_percent" in data["system"]
        assert "disk_usage_percent" in data["system"]
        
        assert "application" in data
        assert "requests_per_minute" in data["application"]
        assert "average_response_time_ms" in data["application"]
        assert "error_rate" in data["application"]
        
        assert "database" in data
        assert "connection_pool_size" in data["database"]
        assert "active_connections" in data["database"]
        assert "slow_queries_count" in data["database"]
    
    @pytest.mark.asyncio
    async def test_health_history(self, async_client: AsyncClient):
        """Test health check history endpoint."""
        response = await async_client.get("/health/history?hours=1")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "history" in data
        assert isinstance(data["history"], list)
        
        if len(data["history"]) > 0:
            entry = data["history"][0]
            assert "timestamp" in entry
            assert "status" in entry
            assert "services" in entry