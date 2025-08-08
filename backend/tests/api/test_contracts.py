"""
Tests for contract CRUD endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.contract import Contract, ContractStatus
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role, Permission
from app.core.security import create_access_token


@pytest.fixture
async def setup_contract_test_data(test_db_session: AsyncSession):
    """Set up test data for contract tests."""
    # Create tenant
    tenant = Tenant(
        name="Legal Corp",
        slug="legal-corp",
        is_active=True
    )
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create permissions
    permissions = {
        'contracts.create': Permission(
            name="contracts.create",
            resource="contracts",
            action="create"
        ),
        'contracts.read': Permission(
            name="contracts.read",
            resource="contracts",
            action="read"
        ),
        'contracts.update': Permission(
            name="contracts.update",
            resource="contracts",
            action="update"
        ),
        'contracts.delete': Permission(
            name="contracts.delete",
            resource="contracts",
            action="delete"
        ),
        'contracts.approve': Permission(
            name="contracts.approve",
            resource="contracts",
            action="approve"
        ),
    }
    
    for perm in permissions.values():
        test_db_session.add(perm)
    await test_db_session.commit()
    
    # Create roles
    manager_role = Role(
        name="Contract Manager",
        slug="contract-manager",
        tenant_id=tenant.id
    )
    viewer_role = Role(
        name="Contract Viewer",
        slug="contract-viewer",
        tenant_id=tenant.id
    )
    
    test_db_session.add(manager_role)
    test_db_session.add(viewer_role)
    await test_db_session.commit()
    
    # Assign permissions to roles
    manager_role.permissions = list(permissions.values())
    viewer_role.permissions = [permissions['contracts.read']]
    
    # Create users
    from app.core.security import get_password_hash
    
    manager_user = User(
        email="manager@legal.com",
        username="manager",
        hashed_password=get_password_hash("Manager123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    viewer_user = User(
        email="viewer@legal.com",
        username="viewer",
        hashed_password=get_password_hash("Viewer123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    admin_user = User(
        email="admin@legal.com",
        username="admin",
        hashed_password=get_password_hash("Admin123!"),
        tenant_id=tenant.id,
        is_active=True,
        is_superuser=True
    )
    
    test_db_session.add(manager_user)
    test_db_session.add(viewer_user)
    test_db_session.add(admin_user)
    await test_db_session.commit()
    
    # Assign roles to users
    manager_user.roles = [manager_role]
    viewer_user.roles = [viewer_role]
    await test_db_session.commit()
    
    # Create some test contracts
    contracts = []
    for i in range(3):
        contract = Contract(
            title=f"Test Contract {i+1}",
            description=f"Description for contract {i+1}",
            contract_number=f"CTR-2024-{i+1:03d}",
            status=ContractStatus.DRAFT if i < 2 else ContractStatus.ACTIVE,
            tenant_id=tenant.id,
            created_by_id=manager_user.id,
            contract_type="NDA" if i == 0 else "SLA",
            parties={"party1": f"Company {i}", "party2": "Legal Corp"},
            metadata={
                "department": "Legal",
                "category": "Standard",
                "value": 10000 * (i + 1)
            }
        )
        if i == 2:  # Set dates for active contract
            contract.start_date = datetime.utcnow()
            contract.end_date = datetime.utcnow() + timedelta(days=365)
            contract.signed_date = datetime.utcnow()
        
        contracts.append(contract)
        test_db_session.add(contract)
    
    await test_db_session.commit()
    
    return {
        'tenant': tenant,
        'permissions': permissions,
        'roles': {
            'manager': manager_role,
            'viewer': viewer_role
        },
        'users': {
            'manager': manager_user,
            'viewer': viewer_user,
            'admin': admin_user
        },
        'contracts': contracts
    }


class TestContractList:
    """Test contract listing endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_contracts_with_permission(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test listing contracts with read permission."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
        assert result["total"] == 3
        assert len(result["items"]) == 3
    
    @pytest.mark.asyncio
    async def test_list_contracts_pagination(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test contract listing with pagination."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts?limit=2&offset=1",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert len(result["items"]) <= 2
        assert result["limit"] == 2
        assert result["offset"] == 1
    
    @pytest.mark.asyncio
    async def test_filter_contracts_by_status(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test filtering contracts by status."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts?status=draft",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] == 2
        for contract in result["items"]:
            assert contract["status"] == "draft"
    
    @pytest.mark.asyncio
    async def test_search_contracts(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test searching contracts by title or description."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts?search=Contract%201",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 1
        assert "Contract 1" in result["items"][0]["title"]
    
    @pytest.mark.asyncio
    async def test_list_contracts_no_permission(
        self,
        async_client: AsyncClient,
        test_db_session: AsyncSession
    ):
        """Test that users without read permission cannot list contracts."""
        # Create user without contract permissions
        tenant = Tenant(name="Test", slug="test", is_active=True)
        test_db_session.add(tenant)
        await test_db_session.commit()
        
        from app.core.security import get_password_hash
        user = User(
            email="noperm@test.com",
            username="noperm",
            hashed_password=get_password_hash("NoPerms123!"),
            tenant_id=tenant.id,
            is_active=True
        )
        test_db_session.add(user)
        await test_db_session.commit()
        
        token = create_access_token({
            "sub": user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestContractGet:
    """Test getting individual contracts."""
    
    @pytest.mark.asyncio
    async def test_get_contract_by_id(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test getting a specific contract by ID."""
        data = setup_contract_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/contracts/{contract.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == contract.id
        assert result["title"] == contract.title
        assert result["contract_number"] == contract.contract_number
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test getting a contract that doesn't exist."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/contracts/99999",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_tenant_isolation_get_contract(
        self,
        async_client: AsyncClient,
        test_db_session: AsyncSession,
        setup_contract_test_data
    ):
        """Test that users cannot access contracts from other tenants."""
        data = setup_contract_test_data
        contract = data['contracts'][0]
        
        # Create another tenant and user
        other_tenant = Tenant(name="Other Corp", slug="other-corp", is_active=True)
        test_db_session.add(other_tenant)
        await test_db_session.commit()
        
        from app.core.security import get_password_hash
        other_user = User(
            email="other@test.com",
            username="other",
            hashed_password=get_password_hash("Other123!"),
            tenant_id=other_tenant.id,
            is_active=True,
            is_superuser=True  # Even superuser shouldn't access other tenant's data
        )
        test_db_session.add(other_user)
        await test_db_session.commit()
        
        token = create_access_token({
            "sub": other_user.email,
            "tenant_id": other_tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/contracts/{contract.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404


class TestContractCreate:
    """Test contract creation."""
    
    @pytest.mark.asyncio
    async def test_create_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test creating a new contract."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        contract_data = {
            "title": "New Service Agreement",
            "description": "Service agreement for IT services",
            "contract_number": "CTR-2024-999",
            "contract_type": "Service Agreement",
            "parties": {
                "client": "ABC Company",
                "vendor": "Legal Corp"
            },
            "metadata": {
                "department": "IT",
                "value": 50000,
                "currency": "USD"
            },
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T23:59:59"
        }
        
        response = await async_client.post(
            "/api/v1/contracts",
            json=contract_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        result = response.json()
        assert result["title"] == contract_data["title"]
        assert result["contract_number"] == contract_data["contract_number"]
        assert result["status"] == "draft"  # Default status
        assert result["tenant_id"] == tenant.id
        assert result["created_by_id"] == manager_user.id
    
    @pytest.mark.asyncio
    async def test_create_contract_duplicate_number(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test that duplicate contract numbers are rejected within tenant."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        existing_contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        contract_data = {
            "title": "Duplicate Contract",
            "contract_number": existing_contract.contract_number  # Duplicate
        }
        
        response = await async_client.post(
            "/api/v1/contracts",
            json=contract_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_create_contract_no_permission(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test that users without create permission cannot create contracts."""
        data = setup_contract_test_data
        viewer_user = data['users']['viewer']  # Only has read permission
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        contract_data = {
            "title": "Unauthorized Contract"
        }
        
        response = await async_client.post(
            "/api/v1/contracts",
            json=contract_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestContractUpdate:
    """Test contract updates."""
    
    @pytest.mark.asyncio
    async def test_update_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test updating a contract."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        update_data = {
            "title": "Updated Contract Title",
            "description": "Updated description",
            "metadata": {
                "department": "Legal",
                "updated": True
            }
        }
        
        response = await async_client.patch(
            f"/api/v1/contracts/{contract.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["title"] == update_data["title"]
        assert result["description"] == update_data["description"]
        assert result["metadata"]["updated"] is True
    
    @pytest.mark.asyncio
    async def test_update_contract_status(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test updating contract status."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        update_data = {
            "status": "review"
        }
        
        response = await async_client.patch(
            f"/api/v1/contracts/{contract.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "review"
    
    @pytest.mark.asyncio
    async def test_update_contract_no_permission(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test that users without update permission cannot update contracts."""
        data = setup_contract_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        update_data = {"title": "Hacked Title"}
        
        response = await async_client.patch(
            f"/api/v1/contracts/{contract.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestContractDelete:
    """Test contract deletion."""
    
    @pytest.mark.asyncio
    async def test_delete_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data,
        test_db_session: AsyncSession
    ):
        """Test deleting (soft delete) a contract."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        contract = data['contracts'][0]
        contract_id = contract.id
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.delete(
            f"/api/v1/contracts/{contract_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()
        
        # Verify contract is soft deleted
        result = await test_db_session.execute(
            select(Contract).where(Contract.id == contract_id)
        )
        deleted_contract = result.scalar_one()
        assert deleted_contract.is_deleted is True
    
    @pytest.mark.asyncio
    async def test_delete_active_contract_prevented(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test that active contracts cannot be deleted without override."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        active_contract = data['contracts'][2]  # This one is active
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.delete(
            f"/api/v1/contracts/{active_contract.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "active contract" in response.json()["detail"].lower()


class TestContractApproval:
    """Test contract approval workflow."""
    
    @pytest.mark.asyncio
    async def test_approve_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test approving a contract."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        approval_data = {
            "action": "approve",
            "comments": "Approved after legal review"
        }
        
        response = await async_client.post(
            f"/api/v1/contracts/{contract.id}/approve",
            json=approval_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "approved"
        assert result["approved_by_id"] == manager_user.id
        assert result["approved_at"] is not None
    
    @pytest.mark.asyncio
    async def test_reject_contract(
        self,
        async_client: AsyncClient,
        setup_contract_test_data
    ):
        """Test rejecting a contract."""
        data = setup_contract_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        contract = data['contracts'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        rejection_data = {
            "action": "reject",
            "comments": "Terms need revision"
        }
        
        response = await async_client.post(
            f"/api/v1/contracts/{contract.id}/approve",
            json=rejection_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "rejected"