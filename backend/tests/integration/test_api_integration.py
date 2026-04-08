"""
Comprehensive API integration tests for Legal AI Platform.
Tests all endpoints with real database connections, multi-tenant isolation,
authentication, authorization, and performance assertions.

Following strict TDD methodology with Red-Green-Refactor cycle.
No mocks or stubs - uses real implementations only.
"""
import pytest

# S3-005: requires live database + all infrastructure services.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: integration tests require live PostgreSQL, Redis, Neo4j, Qdrant, MinIO")
import asyncio
import json
import time
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.tenant import Tenant
from app.models.contract import Contract
from app.models.template import Template
from app.models.workflow import Workflow
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate
from app.schemas.contract import ContractCreate
from app.schemas.template import TemplateCreate
from app.schemas.workflow import WorkflowCreate


class TestAPIIntegration:
    """Comprehensive API integration test suite."""

    @pytest.fixture(autouse=True)
    async def setup(self, test_db_session: AsyncSession):
        """Setup test data before each test."""
        self.db = test_db_session
        
        # Create test tenants
        self.tenant1 = Tenant(
            name="Test Tenant 1",
            subdomain="tenant1",
            is_active=True,
            settings={"features": ["contracts", "templates"]}
        )
        self.tenant2 = Tenant(
            name="Test Tenant 2", 
            subdomain="tenant2",
            is_active=True,
            settings={"features": ["contracts", "workflows"]}
        )
        
        self.db.add_all([self.tenant1, self.tenant2])
        await self.db.commit()
        await self.db.refresh(self.tenant1)
        await self.db.refresh(self.tenant2)
        
        # Create test users
        self.user1 = User(
            email="user1@tenant1.com",
            username="user1",
            full_name="Test User 1",
            hashed_password=get_password_hash("password123"),
            tenant_id=self.tenant1.id,
            is_active=True,
            is_superuser=False
        )
        self.user2 = User(
            email="user2@tenant2.com",
            username="user2", 
            full_name="Test User 2",
            hashed_password=get_password_hash("password123"),
            tenant_id=self.tenant2.id,
            is_active=True,
            is_superuser=False
        )
        self.admin_user = User(
            email="admin@tenant1.com",
            username="admin",
            full_name="Admin User",
            hashed_password=get_password_hash("admin123"),
            tenant_id=self.tenant1.id,
            is_active=True,
            is_superuser=True
        )
        
        self.db.add_all([self.user1, self.user2, self.admin_user])
        await self.db.commit()
        
        # Create authenticated clients
        self.client = AsyncClient(app=app, base_url="http://test")
        self.auth_client1 = await self._create_authenticated_client(self.user1)
        self.auth_client2 = await self._create_authenticated_client(self.user2)
        self.admin_client = await self._create_authenticated_client(self.admin_user)

    async def _create_authenticated_client(self, user: User) -> AsyncClient:
        """Create authenticated client for user."""
        token = create_access_token(
            data={"sub": user.email, "tenant_id": user.tenant_id}
        )
        client = AsyncClient(app=app, base_url="http://test")
        client.headers["Authorization"] = f"Bearer {token}"
        return client

    async def _measure_response_time(self, client: AsyncClient, method: str, url: str, **kwargs) -> tuple:
        """Measure response time for performance testing."""
        start_time = time.time()
        response = await getattr(client, method.lower())(url, **kwargs)
        end_time = time.time()
        return response, (end_time - start_time) * 1000  # ms

    # Authentication API Tests
    
    @pytest.mark.asyncio
    async def test_register_user_success(self):
        """Test successful user registration."""
        user_data = {
            "email": "newuser@tenant1.com",
            "username": "newuser",
            "full_name": "New User",
            "password": "newpassword123",
            "tenant_id": self.tenant1.id
        }
        
        response = await self.client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201
        
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["username"] == user_data["username"]
        assert data["tenant_id"] == user_data["tenant_id"]
        assert "hashed_password" not in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email_fails(self):
        """Test registration fails with duplicate email."""
        user_data = {
            "email": self.user1.email,
            "username": "differentuser",
            "full_name": "Different User", 
            "password": "password123",
            "tenant_id": self.tenant1.id
        }
        
        response = await self.client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400
        assert "email already registered" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_success(self):
        """Test successful login."""
        login_data = {
            "email": self.user1.email,
            "password": "password123"
        }
        
        response, response_time = await self._measure_response_time(
            self.client, "POST", "/api/v1/auth/login", json=login_data
        )
        
        assert response.status_code == 200
        assert response_time < 1000  # < 1s
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        login_data = {
            "email": self.user1.email,
            "password": "wrongpassword"
        }
        
        response = await self.client.post("/api/v1/auth/login", json=login_data)
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_refresh_token_success(self):
        """Test successful token refresh."""
        # First login to get tokens
        login_response = await self.client.post("/api/v1/auth/login", json={
            "email": self.user1.email,
            "password": "password123"
        })
        tokens = login_response.json()
        
        # Refresh token
        refresh_data = {"refresh_token": tokens["refresh_token"]}
        response = await self.client.post("/api/v1/auth/refresh", json=refresh_data)
        
        assert response.status_code == 200
        new_tokens = response.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["access_token"] != tokens["access_token"]

    @pytest.mark.asyncio
    async def test_logout_success(self):
        """Test successful logout."""
        response = await self.auth_client1.post("/api/v1/auth/logout")
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_password_reset_request(self):
        """Test password reset request."""
        reset_data = {"email": self.user1.email}
        response = await self.client.post("/api/v1/auth/password-reset", json=reset_data)
        
        assert response.status_code == 200
        assert "password reset link" in response.json()["message"].lower()

    # Contract API Tests

    @pytest.mark.asyncio
    async def test_create_contract_success(self):
        """Test successful contract creation."""
        contract_data = {
            "title": "Test Contract",
            "description": "Test contract description",
            "contract_type": "service_agreement",
            "status": "draft",
            "metadata": {"priority": "high"}
        }
        
        response, response_time = await self._measure_response_time(
            self.auth_client1, "POST", "/api/v1/contracts", json=contract_data
        )
        
        assert response.status_code == 201
        assert response_time < 2000  # < 2s
        
        data = response.json()
        assert data["title"] == contract_data["title"]
        assert data["tenant_id"] == self.tenant1.id

    @pytest.mark.asyncio
    async def test_get_contracts_with_pagination(self):
        """Test contract listing with pagination."""
        # Create multiple contracts
        for i in range(15):
            contract_data = {
                "title": f"Contract {i}",
                "description": f"Description {i}",
                "contract_type": "service_agreement",
                "status": "draft"
            }
            await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        
        # Test pagination
        response = await self.auth_client1.get("/api/v1/contracts?skip=0&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 15

    @pytest.mark.asyncio
    async def test_get_contract_by_id(self):
        """Test getting contract by ID."""
        # Create contract
        contract_data = {
            "title": "Test Contract",
            "description": "Test description",
            "contract_type": "service_agreement", 
            "status": "draft"
        }
        create_response = await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        contract_id = create_response.json()["id"]
        
        # Get contract
        response, response_time = await self._measure_response_time(
            self.auth_client1, "GET", f"/api/v1/contracts/{contract_id}"
        )
        
        assert response.status_code == 200
        assert response_time < 500  # < 500ms
        
        data = response.json()
        assert data["id"] == contract_id
        assert data["title"] == contract_data["title"]

    @pytest.mark.asyncio
    async def test_update_contract_success(self):
        """Test successful contract update."""
        # Create contract
        contract_data = {
            "title": "Original Title",
            "description": "Original description",
            "contract_type": "service_agreement",
            "status": "draft"
        }
        create_response = await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        contract_id = create_response.json()["id"]
        
        # Update contract
        update_data = {
            "title": "Updated Title",
            "description": "Updated description",
            "status": "review"
        }
        response = await self.auth_client1.put(f"/api/v1/contracts/{contract_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == update_data["title"]
        assert data["status"] == update_data["status"]

    @pytest.mark.asyncio
    async def test_delete_contract_success(self):
        """Test successful contract deletion."""
        # Create contract
        contract_data = {
            "title": "To Delete",
            "description": "Will be deleted",
            "contract_type": "service_agreement",
            "status": "draft"
        }
        create_response = await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        contract_id = create_response.json()["id"]
        
        # Delete contract
        response = await self.auth_client1.delete(f"/api/v1/contracts/{contract_id}")
        assert response.status_code == 204
        
        # Verify deletion
        get_response = await self.auth_client1.get(f"/api/v1/contracts/{contract_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_contract_multi_tenant_isolation(self):
        """Test contracts are isolated between tenants."""
        # Create contract as tenant1 user
        contract_data = {
            "title": "Tenant1 Contract",
            "description": "Should not be visible to tenant2",
            "contract_type": "service_agreement",
            "status": "draft"
        }
        create_response = await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        contract_id = create_response.json()["id"]
        
        # Try to access as tenant2 user
        response = await self.auth_client2.get(f"/api/v1/contracts/{contract_id}")
        assert response.status_code in [403, 404]  # Should not be accessible
        
        # Verify tenant1 user can still access
        response = await self.auth_client1.get(f"/api/v1/contracts/{contract_id}")
        assert response.status_code == 200

    # Template API Tests

    @pytest.mark.asyncio
    async def test_create_template_success(self):
        """Test successful template creation."""
        template_data = {
            "name": "Test Template",
            "description": "Test template description",
            "category": "contract",
            "content": "Template content with {{variables}}",
            "variables": [{"name": "company", "type": "string", "required": True}]
        }
        
        response = await self.auth_client1.post("/api/v1/templates", json=template_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == template_data["name"]
        assert data["tenant_id"] == self.tenant1.id

    @pytest.mark.asyncio
    async def test_get_templates_with_filtering(self):
        """Test template listing with filtering."""
        # Create templates
        template1_data = {
            "name": "Contract Template",
            "category": "contract",
            "content": "Content 1",
            "variables": []
        }
        template2_data = {
            "name": "Email Template",
            "category": "email", 
            "content": "Content 2",
            "variables": []
        }
        
        await self.auth_client1.post("/api/v1/templates", json=template1_data)
        await self.auth_client1.post("/api/v1/templates", json=template2_data)
        
        # Filter by category
        response = await self.auth_client1.get("/api/v1/templates?category=contract")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["category"] == "contract"

    @pytest.mark.asyncio
    async def test_generate_from_template(self):
        """Test generating content from template."""
        # Create template
        template_data = {
            "name": "Contract Template",
            "category": "contract",
            "content": "This contract is between {{company}} and {{client}}.",
            "variables": [
                {"name": "company", "type": "string", "required": True},
                {"name": "client", "type": "string", "required": True}
            ]
        }
        create_response = await self.auth_client1.post("/api/v1/templates", json=template_data)
        template_id = create_response.json()["id"]
        
        # Generate content
        generation_data = {
            "variables": {
                "company": "Acme Corp",
                "client": "Client Inc"
            }
        }
        response = await self.auth_client1.post(
            f"/api/v1/templates/{template_id}/generate",
            json=generation_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "Acme Corp" in data["content"]
        assert "Client Inc" in data["content"]

    # Workflow API Tests

    @pytest.mark.asyncio
    async def test_create_workflow_success(self):
        """Test successful workflow creation."""
        workflow_data = {
            "name": "Contract Review Workflow",
            "description": "Automated contract review process",
            "steps": [
                {
                    "name": "Initial Review",
                    "type": "manual",
                    "config": {"assignee_role": "reviewer"}
                },
                {
                    "name": "Legal Review", 
                    "type": "manual",
                    "config": {"assignee_role": "legal"}
                }
            ],
            "is_active": True
        }
        
        response = await self.auth_client1.post("/api/v1/workflows", json=workflow_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == workflow_data["name"]
        assert len(data["steps"]) == 2

    @pytest.mark.asyncio
    async def test_execute_workflow(self):
        """Test workflow execution."""
        # Create workflow
        workflow_data = {
            "name": "Simple Workflow",
            "description": "Test workflow",
            "steps": [
                {
                    "name": "Step 1",
                    "type": "automated",
                    "config": {"action": "validate"}
                }
            ],
            "is_active": True
        }
        create_response = await self.auth_client1.post("/api/v1/workflows", json=workflow_data)
        workflow_id = create_response.json()["id"]
        
        # Execute workflow
        execution_data = {
            "context": {"entity_id": "123", "entity_type": "contract"}
        }
        response = await self.auth_client1.post(
            f"/api/v1/workflows/{workflow_id}/execute",
            json=execution_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "execution_id" in data
        assert data["status"] == "running"

    @pytest.mark.asyncio
    async def test_get_workflow_tasks(self):
        """Test getting workflow tasks."""
        # Create and execute workflow
        workflow_data = {
            "name": "Task Workflow",
            "description": "Workflow with tasks",
            "steps": [
                {
                    "name": "Manual Task",
                    "type": "manual",
                    "config": {"assignee_role": "user"}
                }
            ],
            "is_active": True
        }
        create_response = await self.auth_client1.post("/api/v1/workflows", json=workflow_data)
        workflow_id = create_response.json()["id"]
        
        # Execute to create tasks
        execution_data = {"context": {"entity_id": "456"}}
        await self.auth_client1.post(f"/api/v1/workflows/{workflow_id}/execute", json=execution_data)
        
        # Get tasks
        response = await self.auth_client1.get(f"/api/v1/workflows/{workflow_id}/tasks")
        assert response.status_code == 200

    # User Management API Tests

    @pytest.mark.asyncio
    async def test_admin_get_users(self):
        """Test admin can get user list."""
        response = await self.admin_client.get("/api/v1/users")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 3  # Our test users

    @pytest.mark.asyncio
    async def test_admin_create_user(self):
        """Test admin can create users."""
        user_data = {
            "email": "newadmin@tenant1.com",
            "username": "newadmin",
            "full_name": "New Admin",
            "password": "adminpass123",
            "tenant_id": self.tenant1.id,
            "is_superuser": True
        }
        
        response = await self.admin_client.post("/api/v1/users", json=user_data)
        assert response.status_code == 201
        
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["is_superuser"] is True

    @pytest.mark.asyncio
    async def test_non_admin_cannot_create_users(self):
        """Test non-admin users cannot create users."""
        user_data = {
            "email": "unauthorized@tenant1.com",
            "username": "unauthorized",
            "full_name": "Unauthorized User",
            "password": "password123",
            "tenant_id": self.tenant1.id
        }
        
        response = await self.auth_client1.post("/api/v1/users", json=user_data)
        assert response.status_code in [403, 401]

    @pytest.mark.asyncio
    async def test_update_user_roles(self):
        """Test updating user roles."""
        # First create a user to update
        user_data = {
            "email": "roletest@tenant1.com",
            "username": "roletest",
            "full_name": "Role Test User",
            "password": "password123",
            "tenant_id": self.tenant1.id
        }
        create_response = await self.admin_client.post("/api/v1/users", json=user_data)
        user_id = create_response.json()["id"]
        
        # Update roles
        role_data = {"roles": ["editor", "reviewer"]}
        response = await self.admin_client.put(f"/api/v1/users/{user_id}/roles", json=role_data)
        
        assert response.status_code == 200
        data = response.json()
        assert set(data["roles"]) == set(role_data["roles"])

    # Search API Tests

    @pytest.mark.asyncio
    async def test_search_contracts(self):
        """Test contract search functionality."""
        # Create contracts with searchable content
        contracts = [
            {"title": "Software License Agreement", "description": "Software licensing terms"},
            {"title": "Service Level Agreement", "description": "SLA terms and conditions"},
            {"title": "Employment Contract", "description": "Employment terms"}
        ]
        
        for contract_data in contracts:
            contract_data.update({
                "contract_type": "service_agreement",
                "status": "draft"
            })
            await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        
        # Search for contracts
        search_data = {
            "query": "agreement",
            "filters": {"status": "draft"}
        }
        
        response, response_time = await self._measure_response_time(
            self.auth_client1, "POST", "/api/v1/search/contracts", json=search_data
        )
        
        assert response.status_code == 200
        assert response_time < 1000  # < 1s
        
        data = response.json()
        assert len(data["results"]) >= 2  # Should find "Agreement" matches

    @pytest.mark.asyncio
    async def test_search_global(self):
        """Test global search across all entities."""
        search_data = {
            "query": "test",
            "types": ["contracts", "templates"]
        }
        
        response = await self.auth_client1.post("/api/v1/search/global", json=search_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data

    @pytest.mark.asyncio
    async def test_search_suggestions(self):
        """Test search suggestions."""
        response = await self.auth_client1.get("/api/v1/search/suggestions?q=contra")
        assert response.status_code == 200
        
        data = response.json()
        assert "suggestions" in data

    # Analytics API Tests

    @pytest.mark.asyncio
    async def test_get_dashboard_analytics(self):
        """Test dashboard analytics endpoint."""
        response, response_time = await self._measure_response_time(
            self.auth_client1, "GET", "/api/v1/analytics/dashboard"
        )
        
        assert response.status_code == 200
        assert response_time < 2000  # < 2s
        
        data = response.json()
        assert "metrics" in data
        assert "charts" in data

    @pytest.mark.asyncio
    async def test_get_contract_analytics(self):
        """Test contract-specific analytics."""
        response = await self.auth_client1.get("/api/v1/analytics/contracts")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_contracts" in data
        assert "status_distribution" in data

    @pytest.mark.asyncio
    async def test_get_performance_analytics(self):
        """Test performance analytics."""
        response = await self.auth_client1.get("/api/v1/analytics/performance")
        assert response.status_code == 200
        
        data = response.json()
        assert "response_times" in data
        assert "throughput" in data

    # Admin API Tests

    @pytest.mark.asyncio
    async def test_admin_get_metrics(self):
        """Test admin metrics endpoint."""
        response = await self.admin_client.get("/api/v1/admin/metrics")
        assert response.status_code == 200
        
        data = response.json()
        assert "system_health" in data
        assert "resource_usage" in data

    @pytest.mark.asyncio
    async def test_admin_get_tenants(self):
        """Test admin can view all tenants."""
        response = await self.admin_client.get("/api/v1/admin/tenants")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["items"]) >= 2  # Our test tenants

    @pytest.mark.asyncio
    async def test_admin_create_tenant(self):
        """Test admin can create new tenants."""
        tenant_data = {
            "name": "New Test Tenant",
            "subdomain": "newtenant",
            "settings": {"features": ["contracts"]}
        }
        
        response = await self.admin_client.post("/api/v1/admin/tenants", json=tenant_data)
        assert response.status_code == 201
        
        data = response.json()
        assert data["name"] == tenant_data["name"]
        assert data["subdomain"] == tenant_data["subdomain"]

    @pytest.mark.asyncio
    async def test_admin_get_audit_logs(self):
        """Test admin can access audit logs."""
        response = await self.admin_client.get("/api/v1/admin/audit-logs?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_admin_update_settings(self):
        """Test admin can update system settings."""
        settings_data = {
            "maintenance_mode": False,
            "max_upload_size": 100,
            "features": {
                "ai_enabled": True,
                "analytics_enabled": True
            }
        }
        
        response = await self.admin_client.put("/api/v1/admin/settings", json=settings_data)
        assert response.status_code == 200

    # Error Handling & Edge Cases

    @pytest.mark.asyncio
    async def test_unauthorized_access(self):
        """Test unauthorized access is properly rejected."""
        response = await self.client.get("/api/v1/contracts")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        """Test invalid token is rejected."""
        invalid_client = AsyncClient(app=app, base_url="http://test")
        invalid_client.headers["Authorization"] = "Bearer invalid-token"
        
        response = await invalid_client.get("/api/v1/contracts")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_not_found_endpoints(self):
        """Test 404 responses for non-existent resources."""
        response = await self.auth_client1.get("/api/v1/contracts/999999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_invalid_data_validation(self):
        """Test data validation errors."""
        invalid_contract_data = {
            "title": "",  # Empty title should fail validation
            "contract_type": "invalid_type"
        }
        
        response = await self.auth_client1.post("/api/v1/contracts", json=invalid_contract_data)
        assert response.status_code == 422

    # Performance & Concurrency Tests

    @pytest.mark.asyncio
    async def test_concurrent_requests(self):
        """Test handling concurrent requests."""
        # Create multiple concurrent contract creation requests
        tasks = []
        for i in range(10):
            contract_data = {
                "title": f"Concurrent Contract {i}",
                "description": f"Created concurrently {i}",
                "contract_type": "service_agreement",
                "status": "draft"
            }
            task = self.auth_client1.post("/api/v1/contracts", json=contract_data)
            tasks.append(task)
        
        # Execute all requests concurrently
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all succeeded
        success_count = sum(1 for r in responses if hasattr(r, 'status_code') and r.status_code == 201)
        assert success_count == 10

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting functionality."""
        # This would require rate limiting to be properly configured
        # For now, we'll test that rapid requests don't break the system
        responses = []
        for i in range(20):
            response = await self.auth_client1.get("/api/v1/contracts?limit=1")
            responses.append(response.status_code)
        
        # Should mostly be 200s, possibly some 429s if rate limiting is active
        success_responses = [r for r in responses if r == 200]
        assert len(success_responses) > 0

    @pytest.mark.asyncio
    async def test_large_dataset_pagination(self):
        """Test pagination with large datasets."""
        # Create 50 contracts
        for i in range(50):
            contract_data = {
                "title": f"Contract {i:03d}",
                "description": f"Contract description {i}",
                "contract_type": "service_agreement",
                "status": "draft"
            }
            await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        
        # Test pagination
        all_contracts = []
        skip = 0
        limit = 20
        
        while True:
            response = await self.auth_client1.get(f"/api/v1/contracts?skip={skip}&limit={limit}")
            assert response.status_code == 200
            
            data = response.json()
            if not data["items"]:
                break
                
            all_contracts.extend(data["items"])
            skip += limit
            
            if len(all_contracts) >= data["total"]:
                break
        
        assert len(all_contracts) >= 50

    # Database Consistency Tests

    @pytest.mark.asyncio
    async def test_transaction_rollback(self):
        """Test database transaction rollback on errors."""
        # This test verifies that failed operations don't leave partial data
        invalid_contract_data = {
            "title": "Test Contract",
            "description": "This should fail due to validation",
            "contract_type": "invalid_type_that_should_fail",
            "status": "draft"
        }
        
        # Count contracts before
        response = await self.auth_client1.get("/api/v1/contracts")
        initial_count = response.json()["total"]
        
        # Try to create invalid contract
        await self.auth_client1.post("/api/v1/contracts", json=invalid_contract_data)
        
        # Count contracts after - should be same
        response = await self.auth_client1.get("/api/v1/contracts")
        final_count = response.json()["total"]
        
        assert final_count == initial_count

    @pytest.mark.asyncio
    async def test_data_integrity_constraints(self):
        """Test database integrity constraints."""
        # Test foreign key constraints
        invalid_contract_data = {
            "title": "Test Contract",
            "description": "Test description",
            "contract_type": "service_agreement", 
            "status": "draft",
            "template_id": 999999  # Non-existent template
        }
        
        response = await self.auth_client1.post("/api/v1/contracts", json=invalid_contract_data)
        assert response.status_code in [400, 422]

    # Security Tests

    @pytest.mark.asyncio
    async def test_sql_injection_protection(self):
        """Test protection against SQL injection."""
        malicious_query = "'; DROP TABLE contracts; --"
        
        # Try SQL injection in search
        response = await self.auth_client1.get(f"/api/v1/contracts?search={malicious_query}")
        # Should not crash and return normal response
        assert response.status_code in [200, 400, 422]

    @pytest.mark.asyncio
    async def test_xss_protection(self):
        """Test XSS protection in user inputs."""
        xss_payload = "<script>alert('xss')</script>"
        
        contract_data = {
            "title": f"Contract {xss_payload}",
            "description": f"Description {xss_payload}",
            "contract_type": "service_agreement",
            "status": "draft"
        }
        
        response = await self.auth_client1.post("/api/v1/contracts", json=contract_data)
        if response.status_code == 201:
            data = response.json()
            # XSS payload should be escaped or sanitized
            assert "<script>" not in data["title"]

    # Cleanup

    async def teardown(self):
        """Cleanup after tests."""
        if hasattr(self, 'client'):
            await self.client.aclose()
        if hasattr(self, 'auth_client1'):
            await self.auth_client1.aclose()
        if hasattr(self, 'auth_client2'):
            await self.auth_client2.aclose()
        if hasattr(self, 'admin_client'):
            await self.admin_client.aclose()


# Additional test utilities and fixtures

@pytest.fixture
async def performance_test_data(test_db_session):
    """Create test data for performance testing."""
    # This would create larger datasets for performance testing
    pass


@pytest.fixture  
async def load_test_clients():
    """Create multiple clients for load testing."""
    clients = []
    for i in range(10):
        client = AsyncClient(app=app, base_url="http://test")
        clients.append(client)
    
    yield clients
    
    for client in clients:
        await client.aclose()


class TestAdvancedFeatures:
    """Test advanced API features."""
    
    @pytest.mark.asyncio
    async def test_webhook_endpoints(self):
        """Test webhook functionality."""
        # This would test webhook registration and triggering
        pass
    
    @pytest.mark.asyncio  
    async def test_batch_operations(self):
        """Test batch API operations."""
        # This would test bulk operations on multiple entities
        pass
    
    @pytest.mark.asyncio
    async def test_real_time_updates(self):
        """Test WebSocket real-time updates."""
        # This would test WebSocket connections and real-time updates
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])