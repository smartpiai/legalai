"""
Tests for document upload and management endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest
import io
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.document import Document
from app.models.contract import Contract, ContractStatus
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role, Permission
from app.core.security import create_access_token


@pytest.fixture
async def setup_document_test_data(test_db_session: AsyncSession):
    """Set up test data for document tests."""
    # Create tenant
    tenant = Tenant(
        name="Doc Corp",
        slug="doc-corp",
        is_active=True
    )
    test_db_session.add(tenant)
    await test_db_session.commit()
    
    # Create permissions
    permissions = {
        'documents.upload': Permission(
            name="documents.upload",
            resource="documents",
            action="upload"
        ),
        'documents.read': Permission(
            name="documents.read",
            resource="documents",
            action="read"
        ),
        'documents.update': Permission(
            name="documents.update",
            resource="documents",
            action="update"
        ),
        'documents.delete': Permission(
            name="documents.delete",
            resource="documents",
            action="delete"
        ),
        'documents.download': Permission(
            name="documents.download",
            resource="documents",
            action="download"
        ),
    }
    
    for perm in permissions.values():
        test_db_session.add(perm)
    await test_db_session.commit()
    
    # Create roles
    doc_manager_role = Role(
        name="Document Manager",
        slug="doc-manager",
        tenant_id=tenant.id
    )
    doc_viewer_role = Role(
        name="Document Viewer",
        slug="doc-viewer",
        tenant_id=tenant.id
    )
    
    test_db_session.add(doc_manager_role)
    test_db_session.add(doc_viewer_role)
    await test_db_session.commit()
    
    # Assign permissions to roles
    doc_manager_role.permissions = list(permissions.values())
    doc_viewer_role.permissions = [
        permissions['documents.read'],
        permissions['documents.download']
    ]
    
    # Create users
    from app.core.security import get_password_hash
    
    manager_user = User(
        email="doc.manager@corp.com",
        username="docmanager",
        hashed_password=get_password_hash("Manager123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    viewer_user = User(
        email="doc.viewer@corp.com",
        username="docviewer",
        hashed_password=get_password_hash("Viewer123!"),
        tenant_id=tenant.id,
        is_active=True
    )
    
    test_db_session.add(manager_user)
    test_db_session.add(viewer_user)
    await test_db_session.commit()
    
    # Assign roles to users
    manager_user.roles = [doc_manager_role]
    viewer_user.roles = [doc_viewer_role]
    await test_db_session.commit()
    
    # Create a test contract to associate documents with
    contract = Contract(
        title="Test Contract for Documents",
        description="Contract for document testing",
        contract_number="DOC-2024-001",
        status=ContractStatus.DRAFT,
        tenant_id=tenant.id,
        created_by_id=manager_user.id
    )
    test_db_session.add(contract)
    await test_db_session.commit()
    
    # Create some test documents
    documents = []
    for i in range(3):
        doc = Document(
            name=f"test_document_{i+1}.pdf",
            file_path=f"tenant_{tenant.id}/contracts/{contract.id}/test_document_{i+1}.pdf",
            file_size=1024 * (i+1),  # 1KB, 2KB, 3KB
            mime_type="application/pdf",
            checksum=f"checksum_{i+1}",
            tenant_id=tenant.id,
            contract_id=contract.id if i < 2 else None,  # First 2 linked to contract
            uploaded_by=manager_user.id,
            metadata={
                "pages": 10 * (i+1),
                "author": f"Author {i+1}"
            }
        )
        documents.append(doc)
        test_db_session.add(doc)
    
    await test_db_session.commit()
    
    return {
        'tenant': tenant,
        'permissions': permissions,
        'roles': {
            'manager': doc_manager_role,
            'viewer': doc_viewer_role
        },
        'users': {
            'manager': manager_user,
            'viewer': viewer_user
        },
        'contract': contract,
        'documents': documents
    }


class TestDocumentUpload:
    """Test document upload functionality."""
    
    @pytest.mark.asyncio
    async def test_upload_document(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test uploading a document."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        # Create a test file
        file_content = b"This is a test PDF content"
        files = {
            "file": ("test.pdf", file_content, "application/pdf")
        }
        
        form_data = {
            "name": "Test Document.pdf",
            "description": "A test document",
            "contract_id": str(data['contract'].id)
        }
        
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            data=form_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Test Document.pdf"
        assert result["mime_type"] == "application/pdf"
        assert result["file_size"] == len(file_content)
        assert result["tenant_id"] == tenant.id
        assert result["uploaded_by"] == manager_user.id
        assert result["contract_id"] == data['contract'].id
    
    @pytest.mark.asyncio
    async def test_upload_document_no_permission(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test that users without upload permission cannot upload documents."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']  # Only has read/download
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        files = {
            "file": ("test.pdf", b"content", "application/pdf")
        }
        
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_upload_invalid_file_type(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test that invalid file types are rejected."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        # Try to upload an executable file
        files = {
            "file": ("malware.exe", b"MZ\x90\x00", "application/x-msdownload")
        }
        
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400
        assert "file type not allowed" in response.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_upload_file_size_limit(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test that files exceeding size limit are rejected."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        # Create a large file (over 100MB limit)
        large_content = b"x" * (101 * 1024 * 1024)  # 101MB
        files = {
            "file": ("large.pdf", large_content, "application/pdf")
        }
        
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 413
        assert "file too large" in response.json()["detail"].lower()


class TestDocumentList:
    """Test document listing and search."""
    
    @pytest.mark.asyncio
    async def test_list_documents(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test listing documents."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/documents",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "items" in result
        assert "total" in result
        assert result["total"] == 3
        assert len(result["items"]) == 3
    
    @pytest.mark.asyncio
    async def test_list_documents_by_contract(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test listing documents filtered by contract."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        contract = data['contract']
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/documents?contract_id={contract.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] == 2  # Only 2 documents linked to contract
        for doc in result["items"]:
            assert doc["contract_id"] == contract.id
    
    @pytest.mark.asyncio
    async def test_search_documents(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test searching documents by name."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            "/api/v1/documents?search=document_1",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 1
        assert "document_1" in result["items"][0]["name"]


class TestDocumentGet:
    """Test getting individual documents."""
    
    @pytest.mark.asyncio
    async def test_get_document(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test getting a specific document."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        document = data['documents'][0]
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/documents/{document.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == document.id
        assert result["name"] == document.name
        assert result["file_path"] == document.file_path
    
    @pytest.mark.asyncio
    async def test_get_document_tenant_isolation(
        self,
        async_client: AsyncClient,
        test_db_session: AsyncSession,
        setup_document_test_data
    ):
        """Test that users cannot access documents from other tenants."""
        data = setup_document_test_data
        document = data['documents'][0]
        
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
            is_superuser=True
        )
        test_db_session.add(other_user)
        await test_db_session.commit()
        
        token = create_access_token({
            "sub": other_user.email,
            "tenant_id": other_tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/documents/{document.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 404


class TestDocumentDownload:
    """Test document download functionality."""
    
    @pytest.mark.asyncio
    async def test_download_document(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test downloading a document."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        document = data['documents'][0]
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/documents/{document.id}/download",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert "download_url" in result
        assert "expires_in" in result
        assert result["expires_in"] == 3600  # 1 hour default
    
    @pytest.mark.asyncio
    async def test_download_no_permission(
        self,
        async_client: AsyncClient,
        test_db_session: AsyncSession,
        setup_document_test_data
    ):
        """Test that users without download permission cannot download."""
        data = setup_document_test_data
        document = data['documents'][0]
        tenant = data['tenant']
        
        # Create user without download permission
        from app.core.security import get_password_hash
        no_download_user = User(
            email="nodownload@test.com",
            username="nodownload",
            hashed_password=get_password_hash("NoDownload123!"),
            tenant_id=tenant.id,
            is_active=True
        )
        test_db_session.add(no_download_user)
        await test_db_session.commit()
        
        token = create_access_token({
            "sub": no_download_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.get(
            f"/api/v1/documents/{document.id}/download",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestDocumentUpdate:
    """Test document update functionality."""
    
    @pytest.mark.asyncio
    async def test_update_document_metadata(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test updating document metadata."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        document = data['documents'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        update_data = {
            "name": "Updated Document Name.pdf",
            "description": "Updated description",
            "metadata": {
                "pages": 20,
                "author": "Updated Author",
                "reviewed": True
            }
        }
        
        response = await async_client.patch(
            f"/api/v1/documents/{document.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["name"] == update_data["name"]
        assert result["description"] == update_data["description"]
        assert result["metadata"]["reviewed"] is True
    
    @pytest.mark.asyncio
    async def test_link_document_to_contract(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test linking a document to a contract."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        document = data['documents'][2]  # This one has no contract
        contract = data['contract']
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        update_data = {
            "contract_id": contract.id
        }
        
        response = await async_client.patch(
            f"/api/v1/documents/{document.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["contract_id"] == contract.id


class TestDocumentDelete:
    """Test document deletion."""
    
    @pytest.mark.asyncio
    async def test_delete_document(
        self,
        async_client: AsyncClient,
        setup_document_test_data,
        test_db_session: AsyncSession
    ):
        """Test deleting a document."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        document = data['documents'][0]
        document_id = document.id
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.delete(
            f"/api/v1/documents/{document_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()
        
        # Verify document is marked as deleted
        result = await test_db_session.execute(
            select(Document).where(Document.id == document_id)
        )
        deleted_doc = result.scalar_one()
        assert deleted_doc.is_active is False
    
    @pytest.mark.asyncio
    async def test_delete_document_no_permission(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test that users without delete permission cannot delete documents."""
        data = setup_document_test_data
        viewer_user = data['users']['viewer']
        tenant = data['tenant']
        document = data['documents'][0]
        
        token = create_access_token({
            "sub": viewer_user.email,
            "tenant_id": tenant.id
        })
        
        response = await async_client.delete(
            f"/api/v1/documents/{document.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403


class TestDocumentVersion:
    """Test document versioning."""
    
    @pytest.mark.asyncio
    async def test_upload_new_version(
        self,
        async_client: AsyncClient,
        setup_document_test_data
    ):
        """Test uploading a new version of a document."""
        data = setup_document_test_data
        manager_user = data['users']['manager']
        tenant = data['tenant']
        original_doc = data['documents'][0]
        
        token = create_access_token({
            "sub": manager_user.email,
            "tenant_id": tenant.id
        })
        
        # Upload new version
        file_content = b"This is version 2 content"
        files = {
            "file": ("test_v2.pdf", file_content, "application/pdf")
        }
        
        form_data = {
            "parent_document_id": str(original_doc.id),
            "version_notes": "Updated content in section 2"
        }
        
        response = await async_client.post(
            "/api/v1/documents/upload",
            files=files,
            data=form_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        result = response.json()
        assert result["parent_document_id"] == original_doc.id
        assert result["version"] == 2
        assert result["contract_id"] == original_doc.contract_id