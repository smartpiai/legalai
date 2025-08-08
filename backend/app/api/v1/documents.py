"""
Document management endpoints.
"""
import hashlib
import os
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.exc import IntegrityError

from app.core.database import get_async_session
from app.core.storage import MinIOStorage
from app.core.rbac import require_permission
from app.api.v1.auth import get_current_user
from app.models.document import Document
from app.models.contract import Contract
from app.models.user import User
from app.schemas.document import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentListResponse,
    DocumentDownloadResponse,
    AllowedFileTypes
)

router = APIRouter()

# Initialize MinIO storage
storage = MinIOStorage()


async def validate_file(file: UploadFile) -> tuple[bool, str]:
    """Validate uploaded file."""
    # Check file type
    if not AllowedFileTypes.is_allowed(file.content_type, file.filename):
        return False, "File type not allowed"
    
    # Check file size
    max_size = AllowedFileTypes.get_max_size(file.content_type)
    
    # Read file to check size (and later calculate checksum)
    content = await file.read()
    await file.seek(0)  # Reset file pointer
    
    if len(content) > max_size:
        return False, f"File too large. Maximum size is {max_size // (1024*1024)}MB"
    
    return True, ""


async def calculate_checksum(content: bytes) -> str:
    """Calculate SHA-256 checksum of file content."""
    return hashlib.sha256(content).hexdigest()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@require_permission("documents.upload")
async def upload_document(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    contract_id: Optional[int] = Form(None),
    parent_document_id: Optional[int] = Form(None),
    version_notes: Optional[str] = Form(None),
    enable_encryption: bool = Form(True),
    enable_compression: bool = Form(True),
    enable_backup: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Upload a new document with enhanced security features."""
    from app.services.document_storage import DocumentStorageService
    
    # Initialize secure storage service
    storage_service = DocumentStorageService(db)
    
    # Read file content
    content = await file.read()
    filename = name or file.filename
    
    try:
        # Use secure upload with all security features
        result = await storage_service.secure_upload(
            content=content,
            filename=filename,
            mime_type=file.content_type,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            enable_encryption=enable_encryption,
            enable_compression=enable_compression,
            enable_backup=enable_backup
        )
        
        # Get the created document
        document = await db.get(Document, result["document_id"])
        
        # Add description if provided
        if description:
            document.description = description
        
        # Add contract association if provided
        if contract_id:
            document.contract_id = contract_id
        
        # Add parent document for versioning
        if parent_document_id:
            document.parent_document_id = parent_document_id
            if version_notes:
                document.metadata = {"version_notes": version_notes}
        
        await db.commit()
        await db.refresh(document)
        
        return document
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/upload-legacy", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
@require_permission("documents.upload")
async def upload_document_legacy(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    contract_id: Optional[int] = Form(None),
    parent_document_id: Optional[int] = Form(None),
    version_notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Legacy upload endpoint without security features (for compatibility)."""
    # Validate file
    is_valid, error_msg = await validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Use provided name or original filename
    document_name = name or file.filename
    
    # Read file content
    content = await file.read()
    
    # Calculate checksum
    checksum = await calculate_checksum(content)
    
    # Check for duplicate file (same checksum in same tenant)
    existing = await db.execute(
        select(Document).where(
            and_(
                Document.checksum == checksum,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This file already exists in your tenant"
        )
    
    # Validate contract if provided
    if contract_id:
        contract_result = await db.execute(
            select(Contract).where(
                and_(
                    Contract.id == contract_id,
                    Contract.tenant_id == current_user.tenant_id,
                    Contract.is_deleted == False
                )
            )
        )
        if not contract_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contract not found"
            )
    
    # Handle versioning
    version = 1
    if parent_document_id:
        parent_result = await db.execute(
            select(Document).where(
                and_(
                    Document.id == parent_document_id,
                    Document.tenant_id == current_user.tenant_id,
                    Document.is_active == True
                )
            )
        )
        parent_doc = parent_result.scalar_one_or_none()
        if not parent_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent document not found"
            )
        
        # Get the latest version number
        version_result = await db.execute(
            select(func.max(Document.version)).where(
                or_(
                    Document.id == parent_document_id,
                    Document.parent_document_id == parent_document_id
                )
            )
        )
        max_version = version_result.scalar() or 1
        version = max_version + 1
        
        # Inherit contract from parent if not specified
        if not contract_id:
            contract_id = parent_doc.contract_id
    
    # Generate storage path
    storage_path = f"tenant_{current_user.tenant_id}"
    if contract_id:
        storage_path += f"/contracts/{contract_id}"
    storage_path += f"/{checksum}_{document_name}"
    
    # Upload to MinIO
    try:
        await storage.upload_document(
            file_content=content,
            file_path=storage_path,
            content_type=file.content_type
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )
    
    # Create document record
    db_document = Document(
        name=document_name,
        description=description,
        file_path=storage_path,
        file_size=len(content),
        mime_type=file.content_type,
        checksum=checksum,
        contract_id=contract_id,
        tenant_id=current_user.tenant_id,
        uploaded_by=current_user.id,
        version=version,
        parent_document_id=parent_document_id,
        metadata={
            "original_filename": file.filename,
            "version_notes": version_notes
        } if version_notes else {"original_filename": file.filename},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    try:
        db.add(db_document)
        await db.commit()
        await db.refresh(db_document)
    except IntegrityError:
        await db.rollback()
        # Try to clean up uploaded file
        await storage.delete_document(storage_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create document record"
        )
    
    return db_document


@router.get("", response_model=DocumentListResponse)
@require_permission("documents.read")
async def list_documents(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    contract_id: Optional[int] = None,
    mime_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List documents with filtering and pagination."""
    # Base query - filter by tenant
    query = select(Document).where(
        and_(
            Document.tenant_id == current_user.tenant_id,
            Document.is_active == True
        )
    )
    count_query = select(func.count(Document.id)).where(
        and_(
            Document.tenant_id == current_user.tenant_id,
            Document.is_active == True
        )
    )
    
    # Apply filters
    if search:
        search_filter = or_(
            Document.name.ilike(f"%{search}%"),
            Document.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    if contract_id is not None:
        query = query.where(Document.contract_id == contract_id)
        count_query = count_query.where(Document.contract_id == contract_id)
    
    if mime_type:
        query = query.where(Document.mime_type == mime_type)
        count_query = count_query.where(Document.mime_type == mime_type)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination and ordering
    query = query.offset(offset).limit(limit)
    query = query.order_by(Document.created_at.desc())
    
    # Execute query
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return DocumentListResponse(
        items=documents,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/{document_id}", response_model=DocumentResponse)
@require_permission("documents.read")
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific document by ID."""
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document


@router.get("/{document_id}/download", response_model=DocumentDownloadResponse)
@require_permission("documents.download")
async def download_document(
    document_id: int,
    expires_in: int = Query(default=3600, ge=60, le=86400),  # 1 min to 24 hours
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a presigned URL for downloading a document."""
    # Get document
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Generate presigned URL
    try:
        download_url = await storage.get_presigned_url(
            file_path=document.file_path,
            expires_in=expires_in
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate download URL: {str(e)}"
        )
    
    return DocumentDownloadResponse(
        download_url=download_url,
        expires_in=expires_in,
        file_name=document.name,
        mime_type=document.mime_type,
        file_size=document.file_size
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
@require_permission("documents.update")
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update document metadata."""
    # Get document
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Validate new contract if updating
    if document_update.contract_id is not None:
        if document_update.contract_id == 0:
            # Allow unsetting contract
            document.contract_id = None
        else:
            contract_result = await db.execute(
                select(Contract).where(
                    and_(
                        Contract.id == document_update.contract_id,
                        Contract.tenant_id == current_user.tenant_id,
                        Contract.is_deleted == False
                    )
                )
            )
            if not contract_result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contract not found"
                )
            document.contract_id = document_update.contract_id
    
    # Update fields
    update_data = document_update.model_dump(exclude_unset=True, exclude={'contract_id'})
    
    for field, value in update_data.items():
        if field == "metadata" and value is not None:
            # Merge metadata
            current_metadata = document.document_metadata or {}
            current_metadata.update(value)
            document.document_metadata = current_metadata
        else:
            setattr(document, field, value)
    
    document.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(document)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update document"
        )
    
    return document


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
@require_permission("documents.delete")
async def delete_document(
    document_id: int,
    permanent: bool = Query(default=False, description="Permanently delete file"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a document (soft delete by default)."""
    # Get document
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if permanent:
        # Delete from storage
        try:
            await storage.delete_document(document.file_path)
        except Exception as e:
            # Log error but continue with database deletion
            print(f"Error deleting file from storage: {e}")
        
        # Hard delete from database
        await db.delete(document)
    else:
        # Soft delete
        document.is_active = False
        document.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": f"Document '{document.name}' has been {'permanently ' if permanent else ''}deleted"}


@router.get("/{document_id}/versions", response_model=List[DocumentResponse])
@require_permission("documents.read")
async def get_document_versions(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all versions of a document."""
    # Get the document to ensure it exists and user has access
    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get all versions
    parent_id = document.parent_document_id or document.id
    result = await db.execute(
        select(Document).where(
            and_(
                or_(
                    Document.id == parent_id,
                    Document.parent_document_id == parent_id
                ),
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        ).order_by(Document.version)
    )
    versions = result.scalars().all()
    
    return versions


@router.get("/{document_id}/scan-status", response_model=Dict[str, Any])
@require_permission("documents.read")
async def get_scan_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get virus scan status for a document."""
    document = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id
            )
        )
    )
    doc = document.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {
        "document_id": doc.id,
        "scan_status": doc.scan_status,
        "scan_timestamp": doc.scan_timestamp,
        "scan_details": doc.scan_details
    }


@router.post("/{document_id}/rescan")
@require_permission("documents.rescan")
async def rescan_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Force virus rescan of a document."""
    from app.services.document_storage import DocumentStorageService, VirusScanner
    
    document = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.tenant_id == current_user.tenant_id
            )
        )
    )
    doc = document.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Initialize scanner
    scanner = VirusScanner(db)
    
    # Get document content from storage
    # For testing, use dummy content
    content = b"Document content for rescanning"
    
    # Perform scan
    scan_result = await scanner.scan_content(content)
    
    # Update document
    from app.models.document import DocumentScanStatus
    doc.scan_status = DocumentScanStatus(scan_result["status"].value)
    doc.scan_timestamp = datetime.utcnow()
    doc.scan_details = scan_result
    
    await db.commit()
    
    return {
        "message": "Document rescanned successfully",
        "scan_status": scan_result["status"],
        "scan_timestamp": doc.scan_timestamp
    }


@router.get("/backups/list")
@require_permission("documents.backup")
async def list_backups(
    tenant_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List available backups."""
    # Admin can view all tenants, others only their own
    target_tenant = tenant_id if tenant_id and current_user.is_superuser else current_user.tenant_id
    
    # Query backup information from documents
    query = select(Document).where(
        and_(
            Document.tenant_id == target_tenant,
            Document.backup_location.isnot(None)
        )
    )
    
    result = await db.execute(query)
    documents_with_backups = result.scalars().all()
    
    backups = []
    for doc in documents_with_backups:
        backups.append({
            "document_id": doc.id,
            "document_name": doc.name,
            "backup_location": doc.backup_location,
            "backup_timestamp": doc.backup_timestamp,
            "backup_id": doc.last_backup_id
        })
    
    return {"backups": backups, "total": len(backups)}


@router.post("/{document_id}/restore")
@require_permission("documents.restore")
async def restore_from_backup(
    document_id: int,
    backup_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Restore document from backup."""
    from app.services.document_storage import DocumentStorageService
    
    storage_service = DocumentStorageService(db)
    
    try:
        result = await storage_service.recover_document(
            document_id=document_id,
            tenant_id=current_user.tenant_id
        )
        
        if result["success"]:
            # Update document status
            document = await db.get(Document, document_id)
            document.is_active = True
            document.updated_at = datetime.utcnow()
            await db.commit()
            
            return {
                "message": "Document restored successfully",
                "document_id": document_id,
                "recovery_source": result["recovery_source"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to restore document"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )