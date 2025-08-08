"""
Celery tasks for asynchronous document extraction.
"""
import logging
from typing import Dict, Any
from celery import shared_task, Task
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from app.core.database import get_async_session
from app.models.document import Document
from app.services.extraction import ExtractionPipeline

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """Task with callback for status updates."""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called on successful task completion."""
        logger.info(f"Task {task_id} completed successfully")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called on task failure."""
        logger.error(f"Task {task_id} failed: {exc}")


@shared_task(base=CallbackTask, bind=True, name='extract_document_metadata')
def extract_document_metadata(self, document_id: int) -> Dict[str, Any]:
    """
    Extract text and metadata from a document asynchronously.
    
    Args:
        document_id: ID of the document to process
        
    Returns:
        Extraction result dictionary
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_extract_document_async(document_id, self))
        return result
    finally:
        loop.close()


async def _extract_document_async(document_id: int, task: Task) -> Dict[str, Any]:
    """Async helper for document extraction."""
    async with get_async_session() as db:
        try:
            # Update task status
            task.update_state(state='PROCESSING', meta={'document_id': document_id})
            
            # Get document
            document = await db.get(Document, document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            # Update extraction status
            document.extraction_status = "processing"
            await db.commit()
            
            # Create pipeline and process
            pipeline = ExtractionPipeline(db_session=db)
            result = await pipeline.process_document(document)
            
            # Update task state with result
            task.update_state(
                state='SUCCESS',
                meta={
                    'document_id': document_id,
                    'success': result.success,
                    'page_count': result.page_count,
                    'processing_time': result.processing_time
                }
            )
            
            return result.to_dict()
            
        except Exception as e:
            logger.error(f"Extraction failed for document {document_id}: {str(e)}")
            
            # Update document status
            if document:
                document.extraction_status = "failed"
                document.extraction_error = str(e)
                await db.commit()
            
            # Update task state
            task.update_state(
                state='FAILURE',
                meta={
                    'document_id': document_id,
                    'error': str(e)
                }
            )
            
            raise


@shared_task(bind=True, name='extract_batch_documents')
def extract_batch_documents(self, document_ids: list[int]) -> Dict[str, Any]:
    """
    Extract text and metadata from multiple documents.
    
    Args:
        document_ids: List of document IDs to process
        
    Returns:
        Batch processing results
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        results = loop.run_until_complete(_extract_batch_async(document_ids, self))
        return results
    finally:
        loop.close()


async def _extract_batch_async(document_ids: list[int], task: Task) -> Dict[str, Any]:
    """Async helper for batch extraction."""
    results = {
        'total': len(document_ids),
        'processed': 0,
        'successful': 0,
        'failed': 0,
        'results': []
    }
    
    async with get_async_session() as db:
        pipeline = ExtractionPipeline(db_session=db)
        
        for idx, doc_id in enumerate(document_ids):
            # Update task progress
            task.update_state(
                state='PROCESSING',
                meta={
                    'current': idx + 1,
                    'total': len(document_ids),
                    'percent': int((idx + 1) / len(document_ids) * 100)
                }
            )
            
            try:
                document = await db.get(Document, doc_id)
                if document:
                    result = await pipeline.process_document(document)
                    results['results'].append({
                        'document_id': doc_id,
                        'success': result.success,
                        'error': result.error_message
                    })
                    
                    if result.success:
                        results['successful'] += 1
                    else:
                        results['failed'] += 1
                else:
                    results['results'].append({
                        'document_id': doc_id,
                        'success': False,
                        'error': 'Document not found'
                    })
                    results['failed'] += 1
                    
            except Exception as e:
                logger.error(f"Failed to process document {doc_id}: {str(e)}")
                results['results'].append({
                    'document_id': doc_id,
                    'success': False,
                    'error': str(e)
                })
                results['failed'] += 1
            
            results['processed'] += 1
    
    return results


@shared_task(name='reprocess_failed_extractions')
def reprocess_failed_extractions(tenant_id: int = None) -> Dict[str, Any]:
    """
    Reprocess all documents that failed extraction.
    
    Args:
        tenant_id: Optional tenant ID to limit reprocessing
        
    Returns:
        Reprocessing results
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        results = loop.run_until_complete(_reprocess_failed_async(tenant_id))
        return results
    finally:
        loop.close()


async def _reprocess_failed_async(tenant_id: int = None) -> Dict[str, Any]:
    """Async helper for reprocessing failed extractions."""
    from sqlalchemy import select, and_
    
    async with get_async_session() as db:
        # Build query for failed documents
        query = select(Document).where(
            Document.extraction_status == "failed"
        )
        
        if tenant_id:
            query = query.where(Document.tenant_id == tenant_id)
        
        result = await db.execute(query)
        failed_documents = result.scalars().all()
        
        # Process each failed document
        pipeline = ExtractionPipeline(db_session=db)
        results = {
            'total_failed': len(failed_documents),
            'reprocessed': 0,
            'now_successful': 0,
            'still_failed': 0
        }
        
        for document in failed_documents:
            try:
                # Reset status
                document.extraction_status = "processing"
                document.extraction_error = None
                await db.commit()
                
                # Reprocess
                result = await pipeline.process_document(document)
                
                results['reprocessed'] += 1
                if result.success:
                    results['now_successful'] += 1
                else:
                    results['still_failed'] += 1
                    
            except Exception as e:
                logger.error(f"Failed to reprocess document {document.id}: {str(e)}")
                results['still_failed'] += 1
        
        return results


@shared_task(name='extraction_health_check')
def extraction_health_check() -> Dict[str, Any]:
    """
    Check the health of the extraction system.
    
    Returns:
        Health check results
    """
    import pytesseract
    import spacy
    
    health = {
        'status': 'healthy',
        'checks': {}
    }
    
    # Check Tesseract OCR
    try:
        tesseract_version = pytesseract.get_tesseract_version()
        health['checks']['tesseract'] = {
            'status': 'ok',
            'version': str(tesseract_version)
        }
    except Exception as e:
        health['checks']['tesseract'] = {
            'status': 'error',
            'error': str(e)
        }
        health['status'] = 'degraded'
    
    # Check Spacy NLP
    try:
        nlp = spacy.load("en_core_web_sm")
        health['checks']['spacy'] = {
            'status': 'ok',
            'model': 'en_core_web_sm'
        }
    except Exception as e:
        health['checks']['spacy'] = {
            'status': 'error',
            'error': str(e)
        }
        health['status'] = 'degraded'
    
    # Check required Python packages
    required_packages = ['pdfplumber', 'python-docx', 'openpyxl', 'pdf2image']
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            health['checks'][package] = {'status': 'ok'}
        except ImportError:
            health['checks'][package] = {'status': 'missing'}
            health['status'] = 'unhealthy'
    
    return health