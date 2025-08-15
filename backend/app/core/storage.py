"""
MinIO object storage implementation for document management.
"""
import io
import os
from typing import Dict, List, Any, Optional, BinaryIO, Union
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error
from app.core.config import settings


class MinIOStorage:
    """MinIO client wrapper for object storage operations."""
    
    def __init__(
        self,
        endpoint: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        secure: Optional[bool] = None
    ):
        """Initialize MinIO connection parameters."""
        self.endpoint = endpoint or settings.MINIO_ENDPOINT
        # Use modern ROOT credentials, fall back to older ACCESS_KEY for compatibility
        self.access_key = access_key or getattr(settings, 'MINIO_ROOT_USER', settings.MINIO_ACCESS_KEY)
        self.secret_key = secret_key or getattr(settings, 'MINIO_ROOT_PASSWORD', settings.MINIO_SECRET_KEY)
        self.secure = secure if secure is not None else settings.MINIO_SECURE
        self.client: Optional[Minio] = None
    
    async def connect(self) -> None:
        """Establish connection to MinIO."""
        if not self.client:
            self.client = Minio(
                self.endpoint,
                access_key=self.access_key,
                secret_key=self.secret_key,
                secure=self.secure
            )
    
    async def close(self) -> None:
        """Close MinIO connection (no-op for MinIO)."""
        pass
    
    async def list_buckets(self) -> List[Dict[str, Any]]:
        """List all buckets."""
        buckets = self.client.list_buckets()
        return [{"name": bucket.name, "created": bucket.creation_date} for bucket in buckets]
    
    async def put_object(
        self,
        bucket_name: str,
        object_name: str,
        data: BinaryIO,
        length: int = -1,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Put an object in MinIO."""
        if length == -1:
            data.seek(0, 2)
            length = data.tell()
            data.seek(0)
        
        result = self.client.put_object(
            bucket_name,
            object_name,
            data,
            length,
            content_type=content_type,
            metadata=metadata
        )
        
        return {
            "etag": result.etag,
            "version_id": result.version_id,
            "object_name": object_name
        }
    
    async def upload_document(
        self,
        file_content: bytes,
        file_path: str,
        content_type: str = "application/octet-stream"
    ) -> None:
        """
        Upload a document to MinIO.
        
        Args:
            file_content: File content as bytes
            file_path: Path where to store the file
            content_type: MIME type of the file
        """
        bucket_name = "legal-documents"
        
        # Ensure bucket exists
        if not self.client:
            await self.connect()
        
        try:
            if not self.client.bucket_exists(bucket_name):
                self.client.make_bucket(bucket_name)
        except S3Error:
            pass
        
        # Upload file
        file_stream = io.BytesIO(file_content)
        await self.put_object(
            bucket_name=bucket_name,
            object_name=file_path,
            data=file_stream,
            length=len(file_content),
            content_type=content_type
        )
    
    async def get_presigned_url(
        self,
        file_path: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate a presigned URL for file download.
        
        Args:
            file_path: Path to the file in MinIO
            expires_in: URL expiration time in seconds
            
        Returns:
            Presigned URL
        """
        bucket_name = "legal-documents"
        
        if not self.client:
            await self.connect()
        
        url = await generate_presigned_url(
            self, 
            bucket_name, 
            file_path, 
            expires_in
        )
        
        if not url:
            raise Exception("Failed to generate presigned URL")
        
        return url
    
    async def delete_document(self, file_path: str) -> None:
        """
        Delete a document from MinIO.
        
        Args:
            file_path: Path to the file in MinIO
        """
        bucket_name = "legal-documents"
        
        if not self.client:
            await self.connect()
        
        success = await delete_file(
            self,
            bucket_name,
            file_path
        )
        
        if not success:
            raise Exception(f"Failed to delete file: {file_path}")


_storage_client: Optional[MinIOStorage] = None


async def get_storage_client() -> MinIOStorage:
    """Get MinIO storage client singleton."""
    global _storage_client
    if not _storage_client:
        _storage_client = MinIOStorage()
        await _storage_client.connect()
    return _storage_client


async def create_bucket(client: MinIOStorage, bucket_name: str) -> bool:
    """
    Create a new storage bucket.
    
    Args:
        client: MinIO storage client
        bucket_name: Name of the bucket
        
    Returns:
        True if successful
    """
    try:
        if not client.client.bucket_exists(bucket_name):
            client.client.make_bucket(bucket_name)
        return True
    except S3Error:
        return False


async def delete_bucket(client: MinIOStorage, bucket_name: str) -> bool:
    """
    Delete a storage bucket.
    
    Args:
        client: MinIO storage client
        bucket_name: Name of the bucket
        
    Returns:
        True if successful
    """
    try:
        client.client.remove_bucket(bucket_name)
        return True
    except S3Error:
        return False


async def upload_file(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str,
    file_data: BinaryIO,
    content_type: str = "application/octet-stream",
    metadata: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Upload a file to MinIO.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        file_data: File data stream
        content_type: MIME type
        metadata: Optional metadata
        
    Returns:
        Upload result
    """
    try:
        # Get file size
        file_data.seek(0, 2)
        size = file_data.tell()
        file_data.seek(0)
        
        result = await client.put_object(
            bucket_name,
            file_name,
            file_data,
            size,
            content_type,
            metadata
        )
        
        return {
            "status": "success",
            "file_name": file_name,
            "size": size,
            "etag": result["etag"]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


async def download_file(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str
) -> Optional[BinaryIO]:
    """
    Download a file from MinIO.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        
    Returns:
        File data stream or None
    """
    try:
        response = client.client.get_object(bucket_name, file_name)
        data = response.read()
        response.close()
        response.release_conn()
        return io.BytesIO(data)
    except S3Error:
        return None


async def delete_file(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str
) -> bool:
    """
    Delete a file from MinIO.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        
    Returns:
        True if successful
    """
    try:
        client.client.remove_object(bucket_name, file_name)
        return True
    except S3Error:
        return False


async def list_files(
    client: MinIOStorage,
    bucket_name: str,
    prefix: str = "",
    recursive: bool = True
) -> List[Dict[str, Any]]:
    """
    List files in a bucket.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        prefix: Path prefix filter
        recursive: List recursively
        
    Returns:
        List of file information
    """
    try:
        objects = client.client.list_objects(
            bucket_name,
            prefix=prefix,
            recursive=recursive
        )
        
        files = []
        for obj in objects:
            files.append({
                "name": obj.object_name,
                "size": obj.size,
                "last_modified": obj.last_modified,
                "etag": obj.etag
            })
        
        return files
    except S3Error:
        return []


async def get_file_info(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str
) -> Optional[Dict[str, Any]]:
    """
    Get file metadata and information.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        
    Returns:
        File information or None
    """
    try:
        stat = client.client.stat_object(bucket_name, file_name)
        return {
            "name": file_name,
            "size": stat.size,
            "last_modified": stat.last_modified,
            "etag": stat.etag,
            "content_type": stat.content_type,
            "metadata": stat.metadata or {}
        }
    except S3Error:
        return None


async def generate_presigned_url(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str,
    expires_in: int = 3600
) -> Optional[str]:
    """
    Generate a presigned URL for direct file access.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        expires_in: URL expiration in seconds
        
    Returns:
        Presigned URL or None
    """
    try:
        url = client.client.presigned_get_object(
            bucket_name,
            file_name,
            expires=timedelta(seconds=expires_in)
        )
        return url
    except S3Error:
        return None


async def move_file(
    client: MinIOStorage,
    source_bucket: str,
    source_name: str,
    dest_bucket: str,
    dest_name: str
) -> bool:
    """
    Move a file to a new location.
    
    Args:
        client: MinIO storage client
        source_bucket: Source bucket
        source_name: Source file name
        dest_bucket: Destination bucket
        dest_name: Destination file name
        
    Returns:
        True if successful
    """
    try:
        # Copy to new location
        client.client.copy_object(
            dest_bucket,
            dest_name,
            f"{source_bucket}/{source_name}"
        )
        # Delete original
        client.client.remove_object(source_bucket, source_name)
        return True
    except S3Error:
        return False


async def copy_file(
    client: MinIOStorage,
    source_bucket: str,
    source_name: str,
    dest_bucket: str,
    dest_name: str
) -> bool:
    """
    Copy a file to a new location.
    
    Args:
        client: MinIO storage client
        source_bucket: Source bucket
        source_name: Source file name
        dest_bucket: Destination bucket
        dest_name: Destination file name
        
    Returns:
        True if successful
    """
    try:
        client.client.copy_object(
            dest_bucket,
            dest_name,
            f"{source_bucket}/{source_name}"
        )
        return True
    except S3Error:
        return False


async def set_file_metadata(
    client: MinIOStorage,
    bucket_name: str,
    file_name: str,
    metadata: Dict[str, str]
) -> bool:
    """
    Update file metadata.
    
    Args:
        client: MinIO storage client
        bucket_name: Bucket name
        file_name: File name/path
        metadata: New metadata
        
    Returns:
        True if successful
    """
    try:
        # Get current object info
        stat = client.client.stat_object(bucket_name, file_name)
        
        # Copy object with new metadata (MinIO doesn't support direct metadata update)
        client.client.copy_object(
            bucket_name,
            file_name,
            f"{bucket_name}/{file_name}",
            metadata=metadata,
            metadata_directive="REPLACE"
        )
        return True
    except S3Error:
        return False


async def upload_contract_document(
    client: MinIOStorage,
    contract_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Upload a contract document with proper organization.
    
    Args:
        client: MinIO storage client
        contract_data: Contract document data
        
    Returns:
        Upload result
    """
    tenant_id = contract_data["tenant_id"]
    contract_id = contract_data["contract_id"]
    document_type = contract_data["document_type"]
    file_name = contract_data["file_name"]
    
    # Organize path by tenant and contract
    path = f"tenant-{tenant_id}/contracts/{contract_id}/{document_type}/{file_name}"
    
    # Ensure bucket exists
    bucket_name = "legal-documents"
    await create_bucket(client, bucket_name)
    
    # Upload with metadata
    metadata = contract_data.get("metadata", {})
    metadata.update({
        "tenant_id": str(tenant_id),
        "contract_id": contract_id,
        "document_type": document_type,
        "uploaded_at": datetime.utcnow().isoformat()
    })
    
    result = await upload_file(
        client,
        bucket_name,
        path,
        contract_data["content"],
        metadata=metadata
    )
    
    if result["status"] == "success":
        result["path"] = path
        result["document_type"] = document_type
    
    return result


async def get_contract_documents(
    client: MinIOStorage,
    tenant_id: int,
    contract_id: str
) -> List[Dict[str, Any]]:
    """
    Get all documents for a contract.
    
    Args:
        client: MinIO storage client
        tenant_id: Tenant ID
        contract_id: Contract ID
        
    Returns:
        List of contract documents
    """
    bucket_name = "legal-documents"
    prefix = f"tenant-{tenant_id}/contracts/{contract_id}/"
    
    files = await list_files(client, bucket_name, prefix)
    
    documents = []
    for file in files:
        # Parse document type from path
        path_parts = file["name"].split("/")
        if len(path_parts) >= 5:
            document_type = path_parts[3]
            documents.append({
                "path": file["name"],
                "document_type": document_type,
                "file_name": path_parts[-1],
                "size": file["size"],
                "last_modified": file["last_modified"]
            })
    
    return documents


async def check_storage_quota(
    client: MinIOStorage,
    tenant_id: int,
    quota_gb: int = 100
) -> Dict[str, Any]:
    """
    Check storage quota for a tenant.
    
    Args:
        client: MinIO storage client
        tenant_id: Tenant ID
        quota_gb: Quota limit in GB
        
    Returns:
        Quota information
    """
    bucket_name = "legal-documents"
    prefix = f"tenant-{tenant_id}/"
    
    files = await list_files(client, bucket_name, prefix)
    
    total_size = sum(file["size"] for file in files)
    file_count = len(files)
    quota_bytes = quota_gb * 1024 * 1024 * 1024
    
    return {
        "tenant_id": tenant_id,
        "used_bytes": total_size,
        "quota_bytes": quota_bytes,
        "file_count": file_count,
        "percentage_used": (total_size / quota_bytes * 100) if quota_bytes > 0 else 0
    }
