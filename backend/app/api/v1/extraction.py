"""
Document extraction API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_async_session
from app.core.rbac import require_permission
from app.api.v1.auth import get_current_user
from app.models.document import Document
from app.models.user import User
from app.services.extraction import ExtractionPipeline
from app.tasks.extraction import extract_document_metadata, extract_batch_documents

router = APIRouter()


@router.post("/{document_id}/extract")
@require_permission("documents.extract")
async def trigger_extraction(
    document_id: int,
    async_mode: bool = Query(default=True, description="Process asynchronously with Celery"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Trigger text and metadata extraction for a document."""
    # Get document and verify access
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
    
    # Check if already processing
    if document.extraction_status == "processing":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is already being processed"
        )
    
    if async_mode:
        # Process asynchronously with Celery
        task = extract_document_metadata.delay(document_id)
        
        return {
            "message": "Extraction started",
            "task_id": task.id,
            "document_id": document_id,
            "status": "processing"
        }
    else:
        # Process synchronously (for small documents or testing)
        pipeline = ExtractionPipeline(db_session=db)
        result = await pipeline.process_document(document)
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Extraction failed: {result.error_message}"
            )
        
        return {
            "message": "Extraction completed",
            "document_id": document_id,
            "status": "completed",
            "extracted_text_length": len(result.extracted_text),
            "metadata": result.metadata,
            "processing_time": result.processing_time
        }


@router.post("/batch/extract")
@require_permission("documents.extract")
async def trigger_batch_extraction(
    document_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Trigger extraction for multiple documents."""
    # Verify all documents belong to user's tenant
    result = await db.execute(
        select(Document.id).where(
            and_(
                Document.id.in_(document_ids),
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    valid_ids = [row[0] for row in result.fetchall()]
    
    if len(valid_ids) != len(document_ids):
        invalid_ids = set(document_ids) - set(valid_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document IDs: {invalid_ids}"
        )
    
    # Start batch processing
    task = extract_batch_documents.delay(valid_ids)
    
    return {
        "message": "Batch extraction started",
        "task_id": task.id,
        "document_count": len(valid_ids),
        "status": "processing"
    }


@router.get("/{document_id}/extraction-status")
@require_permission("documents.read")
async def get_extraction_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get extraction status for a document."""
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
    
    response = {
        "document_id": document_id,
        "extraction_status": document.extraction_status,
        "has_extracted_text": bool(document.extracted_text),
        "extracted_text_length": len(document.extracted_text) if document.extracted_text else 0
    }
    
    if document.extraction_error:
        response["error"] = document.extraction_error
    
    if document.metadata:
        # Extract key metadata
        response["metadata_summary"] = {
            "title": document.metadata.get("title"),
            "document_type": document.metadata.get("document_type"),
            "contract_number": document.metadata.get("contract_number"),
            "party_count": len(document.metadata.get("parties", [])),
            "effective_date": document.metadata.get("effective_date"),
            "page_count": document.metadata.get("page_count"),
            "extraction_method": document.metadata.get("extraction_method"),
            "ocr_confidence": document.metadata.get("ocr_confidence")
        }
    
    return response


@router.get("/extraction-stats")
@require_permission("documents.read")
async def get_extraction_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get extraction statistics for tenant's documents."""
    from sqlalchemy import func
    
    # Get counts by status
    result = await db.execute(
        select(
            Document.extraction_status,
            func.count(Document.id).label('count')
        ).where(
            and_(
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        ).group_by(Document.extraction_status)
    )
    
    status_counts = {row[0]: row[1] for row in result.fetchall()}
    
    # Get total document count
    total_result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True
            )
        )
    )
    total_count = total_result.scalar() or 0
    
    # Calculate percentages
    stats = {
        "total_documents": total_count,
        "extraction_status": {
            "pending": status_counts.get("pending", 0),
            "processing": status_counts.get("processing", 0),
            "completed": status_counts.get("completed", 0),
            "failed": status_counts.get("failed", 0)
        },
        "extraction_rate": {
            "success_rate": (status_counts.get("completed", 0) / total_count * 100) if total_count > 0 else 0,
            "failure_rate": (status_counts.get("failed", 0) / total_count * 100) if total_count > 0 else 0,
            "pending_rate": (status_counts.get("pending", 0) / total_count * 100) if total_count > 0 else 0
        }
    }
    
    # Get documents with OCR
    ocr_result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.tenant_id == current_user.tenant_id,
                Document.is_active == True,
                Document.metadata['extraction_method'].astext == 'tesseract_ocr'
            )
        )
    )
    stats["ocr_processed_count"] = ocr_result.scalar() or 0
    
    return stats


@router.post("/reprocess-failed")
@require_permission("documents.extract")
async def reprocess_failed_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Reprocess all failed document extractions for the tenant."""
    from app.tasks.extraction import reprocess_failed_extractions
    
    # Start reprocessing task
    task = reprocess_failed_extractions.delay(current_user.tenant_id)
    
    # Get count of failed documents
    result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.tenant_id == current_user.tenant_id,
                Document.extraction_status == "failed",
                Document.is_active == True
            )
        )
    )
    failed_count = result.scalar() or 0
    
    return {
        "message": "Reprocessing started",
        "task_id": task.id,
        "failed_document_count": failed_count,
        "status": "processing"
    }


@router.get("/health")
async def extraction_health_check():
    """Check health of extraction system."""
    from app.tasks.extraction import extraction_health_check
    
    # Run health check
    result = extraction_health_check()
    
    if result['status'] == 'unhealthy':
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result
        )
    
    return result