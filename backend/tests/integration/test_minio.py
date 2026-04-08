"""
Integration tests for MinIO object storage operations.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: requires live MinIO instance.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: integration test requires live MinIO service")

import io
import asyncio
import pytest
from typing import Dict, List, Any, Optional, BinaryIO
from datetime import datetime, timedelta

from app.core.storage import (
    MinIOStorage,
    get_storage_client,
    create_bucket,
    delete_bucket,
    upload_file,
    download_file,
    delete_file,
    list_files,
    get_file_info,
    generate_presigned_url,
    upload_contract_document,
    get_contract_documents,
    move_file,
    copy_file,
    set_file_metadata,
    check_storage_quota
)


@pytest.fixture
async def storage_client():
    """Create a MinIO storage client for testing."""
    client = MinIOStorage()
    await client.connect()
    
    # Create test bucket
    test_bucket = "test-bucket"
    await create_bucket(client, test_bucket)
    
    yield client
    
    # Cleanup
    try:
        # Delete all objects in test bucket
        files = await list_files(client, test_bucket)
        for file in files:
            await delete_file(client, test_bucket, file["name"])
        await delete_bucket(client, test_bucket)
    except:
        pass
    await client.close()


class TestMinIOConnection:
    """Test MinIO connection and basic operations."""
    
    @pytest.mark.asyncio
    async def test_minio_connection(self, storage_client: MinIOStorage):
        """Test that we can connect to MinIO."""
        buckets = await storage_client.list_buckets()
        assert isinstance(buckets, list)
    
    @pytest.mark.asyncio
    async def test_create_bucket(self, storage_client: MinIOStorage):
        """Test creating a storage bucket."""
        bucket_name = "test-create-bucket"
        
        result = await create_bucket(storage_client, bucket_name)
        assert result is True
        
        # Verify bucket exists
        buckets = await storage_client.list_buckets()
        bucket_names = [b["name"] for b in buckets]
        assert bucket_name in bucket_names
        
        # Cleanup
        await delete_bucket(storage_client, bucket_name)
    
    @pytest.mark.asyncio
    async def test_upload_file(self, storage_client: MinIOStorage):
        """Test uploading a file to MinIO."""
        bucket_name = "test-bucket"
        file_name = "test-document.txt"
        content = b"This is a test document content"
        
        result = await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(content),
            content_type="text/plain",
            metadata={"uploaded_by": "test_user"}
        )
        
        assert result["status"] == "success"
        assert result["file_name"] == file_name
        assert result["size"] == len(content)
    
    @pytest.mark.asyncio
    async def test_download_file(self, storage_client: MinIOStorage):
        """Test downloading a file from MinIO."""
        bucket_name = "test-bucket"
        file_name = "test-download.txt"
        content = b"Download test content"
        
        # Upload file first
        await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(content)
        )
        
        # Download file
        downloaded = await download_file(storage_client, bucket_name, file_name)
        
        assert downloaded is not None
        assert downloaded.read() == content
    
    @pytest.mark.asyncio
    async def test_delete_file(self, storage_client: MinIOStorage):
        """Test deleting a file from MinIO."""
        bucket_name = "test-bucket"
        file_name = "test-delete.txt"
        
        # Upload file first
        await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(b"Delete me")
        )
        
        # Delete file
        result = await delete_file(storage_client, bucket_name, file_name)
        assert result is True
        
        # Verify deletion
        files = await list_files(storage_client, bucket_name)
        file_names = [f["name"] for f in files]
        assert file_name not in file_names
    
    @pytest.mark.asyncio
    async def test_list_files(self, storage_client: MinIOStorage):
        """Test listing files in a bucket."""
        bucket_name = "test-bucket"
        
        # Upload multiple files
        for i in range(3):
            await upload_file(
                storage_client,
                bucket_name,
                f"list-test-{i}.txt",
                io.BytesIO(f"Content {i}".encode())
            )
        
        # List files
        files = await list_files(storage_client, bucket_name, prefix="list-test")
        
        assert len(files) == 3
        for i, file in enumerate(sorted(files, key=lambda x: x["name"])):
            assert file["name"] == f"list-test-{i}.txt"
            assert file["size"] > 0
    
    @pytest.mark.asyncio
    async def test_get_file_info(self, storage_client: MinIOStorage):
        """Test getting file metadata."""
        bucket_name = "test-bucket"
        file_name = "test-info.txt"
        content = b"File info test"
        metadata = {"author": "test_user", "version": "1.0"}
        
        # Upload file with metadata
        await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(content),
            metadata=metadata
        )
        
        # Get file info
        info = await get_file_info(storage_client, bucket_name, file_name)
        
        assert info["name"] == file_name
        assert info["size"] == len(content)
        assert "last_modified" in info
        assert info["metadata"]["author"] == "test_user"


class TestMinIOAdvancedOperations:
    """Test advanced MinIO operations."""
    
    @pytest.mark.asyncio
    async def test_generate_presigned_url(self, storage_client: MinIOStorage):
        """Test generating presigned URLs for direct access."""
        bucket_name = "test-bucket"
        file_name = "test-presigned.pdf"
        
        # Upload file
        await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(b"PDF content")
        )
        
        # Generate presigned URL
        url = await generate_presigned_url(
            storage_client,
            bucket_name,
            file_name,
            expires_in=3600
        )
        
        assert url is not None
        assert file_name in url
        assert "X-Amz-Signature" in url or "signature" in url.lower()
    
    @pytest.mark.asyncio
    async def test_move_file(self, storage_client: MinIOStorage):
        """Test moving files between locations."""
        bucket_name = "test-bucket"
        source_name = "source-file.txt"
        dest_name = "moved-file.txt"
        content = b"Move me"
        
        # Upload source file
        await upload_file(
            storage_client,
            bucket_name,
            source_name,
            io.BytesIO(content)
        )
        
        # Move file
        result = await move_file(
            storage_client,
            bucket_name,
            source_name,
            bucket_name,
            dest_name
        )
        
        assert result is True
        
        # Verify move
        files = await list_files(storage_client, bucket_name)
        file_names = [f["name"] for f in files]
        assert source_name not in file_names
        assert dest_name in file_names
    
    @pytest.mark.asyncio
    async def test_copy_file(self, storage_client: MinIOStorage):
        """Test copying files."""
        bucket_name = "test-bucket"
        source_name = "original.txt"
        copy_name = "copy.txt"
        content = b"Copy me"
        
        # Upload source file
        await upload_file(
            storage_client,
            bucket_name,
            source_name,
            io.BytesIO(content)
        )
        
        # Copy file
        result = await copy_file(
            storage_client,
            bucket_name,
            source_name,
            bucket_name,
            copy_name
        )
        
        assert result is True
        
        # Verify both files exist
        files = await list_files(storage_client, bucket_name)
        file_names = [f["name"] for f in files]
        assert source_name in file_names
        assert copy_name in file_names
    
    @pytest.mark.asyncio
    async def test_set_file_metadata(self, storage_client: MinIOStorage):
        """Test updating file metadata."""
        bucket_name = "test-bucket"
        file_name = "metadata-test.txt"
        
        # Upload file
        await upload_file(
            storage_client,
            bucket_name,
            file_name,
            io.BytesIO(b"Test content"),
            metadata={"version": "1.0"}
        )
        
        # Update metadata
        new_metadata = {
            "version": "2.0",
            "updated_by": "admin",
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = await set_file_metadata(
            storage_client,
            bucket_name,
            file_name,
            new_metadata
        )
        
        assert result is True
        
        # Verify metadata update
        info = await get_file_info(storage_client, bucket_name, file_name)
        assert info["metadata"]["version"] == "2.0"
        assert info["metadata"]["updated_by"] == "admin"


class TestMinIOContractOperations:
    """Test contract-specific storage operations."""
    
    @pytest.mark.asyncio
    async def test_upload_contract_document(self, storage_client: MinIOStorage):
        """Test uploading contract documents with organization."""
        contract_data = {
            "contract_id": "contract-123",
            "tenant_id": 1,
            "document_type": "main",
            "file_name": "service-agreement.pdf",
            "content": io.BytesIO(b"Contract PDF content"),
            "metadata": {
                "version": "1.0",
                "status": "draft",
                "uploaded_by": "user-456"
            }
        }
        
        result = await upload_contract_document(storage_client, contract_data)
        
        assert result["status"] == "success"
        assert "path" in result
        assert f"tenant-1/contracts/contract-123" in result["path"]
        assert result["document_type"] == "main"
    
    @pytest.mark.asyncio
    async def test_get_contract_documents(self, storage_client: MinIOStorage):
        """Test retrieving all documents for a contract."""
        contract_id = "contract-789"
        tenant_id = 1
        
        # Upload multiple documents for the contract
        documents = [
            {"type": "main", "name": "agreement.pdf", "content": b"Main contract"},
            {"type": "amendment", "name": "amendment-1.pdf", "content": b"Amendment 1"},
            {"type": "attachment", "name": "exhibit-a.pdf", "content": b"Exhibit A"}
        ]
        
        for doc in documents:
            await upload_contract_document(
                storage_client,
                {
                    "contract_id": contract_id,
                    "tenant_id": tenant_id,
                    "document_type": doc["type"],
                    "file_name": doc["name"],
                    "content": io.BytesIO(doc["content"])
                }
            )
        
        # Get all contract documents
        retrieved = await get_contract_documents(
            storage_client,
            tenant_id,
            contract_id
        )
        
        assert len(retrieved) == 3
        doc_types = {doc["document_type"] for doc in retrieved}
        assert doc_types == {"main", "amendment", "attachment"}


class TestMinIOMultiTenancy:
    """Test multi-tenant storage isolation."""
    
    @pytest.mark.asyncio
    async def test_tenant_storage_isolation(self, storage_client: MinIOStorage):
        """Test that tenant data is properly isolated."""
        bucket_name = "test-bucket"
        
        # Upload files for different tenants
        for tenant_id in [1, 2]:
            for i in range(2):
                path = f"tenant-{tenant_id}/documents/file-{i}.txt"
                await storage_client.put_object(
                    bucket_name,
                    path,
                    io.BytesIO(f"Tenant {tenant_id} file {i}".encode())
                )
        
        # List files for tenant 1
        tenant1_files = await list_files(
            storage_client,
            bucket_name,
            prefix="tenant-1/"
        )
        
        assert len(tenant1_files) == 2
        for file in tenant1_files:
            assert file["name"].startswith("tenant-1/")
    
    @pytest.mark.asyncio
    async def test_check_storage_quota(self, storage_client: MinIOStorage):
        """Test storage quota checking for tenants."""
        tenant_id = 1
        
        # Upload some files
        for i in range(3):
            await upload_contract_document(
                storage_client,
                {
                    "contract_id": f"quota-test-{i}",
                    "tenant_id": tenant_id,
                    "document_type": "main",
                    "file_name": f"doc-{i}.pdf",
                    "content": io.BytesIO(b"X" * 1024)  # 1KB each
                }
            )
        
        # Check storage quota
        quota_info = await check_storage_quota(storage_client, tenant_id)
        
        assert quota_info["used_bytes"] >= 3072  # At least 3KB
        assert quota_info["file_count"] >= 3
        assert "quota_bytes" in quota_info
        assert quota_info["percentage_used"] >= 0


class TestMinIOPerformance:
    """Test MinIO performance characteristics."""
    
    @pytest.mark.asyncio
    async def test_bulk_upload_performance(self, storage_client: MinIOStorage):
        """Test performance of bulk file uploads."""
        import time
        bucket_name = "test-bucket"
        
        start_time = time.time()
        
        # Upload 20 files concurrently
        tasks = []
        for i in range(20):
            task = upload_file(
                storage_client,
                bucket_name,
                f"bulk-{i}.txt",
                io.BytesIO(f"Content {i}".encode() * 100)
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        elapsed_time = time.time() - start_time
        
        assert all(r["status"] == "success" for r in results)
        assert elapsed_time < 10.0  # Should complete within 10 seconds
    
    @pytest.mark.asyncio
    async def test_large_file_handling(self, storage_client: MinIOStorage):
        """Test handling of large files."""
        bucket_name = "test-bucket"
        file_name = "large-file.bin"
        
        # Create a 5MB file
        size_mb = 5
        content = io.BytesIO(b"X" * (size_mb * 1024 * 1024))
        
        result = await upload_file(
            storage_client,
            bucket_name,
            file_name,
            content,
            content_type="application/octet-stream"
        )
        
        assert result["status"] == "success"
        assert result["size"] == size_mb * 1024 * 1024