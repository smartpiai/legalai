"""
RAG (Retrieval-Augmented Generation) API endpoints.
Provides embedding generation, semantic search, and question answering capabilities.
"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.auth import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.embedding import (
    RAGPipeline,
    EmbeddingService,
    VectorSearchService,
    DocumentChunker,
    SemanticSearchQuery,
    EmbeddingProvider
)
from app.schemas.rag import (
    SemanticSearchRequest,
    SemanticSearchResponseSchema,
    QuestionRequest,
    QuestionResponseSchema,
    BatchEmbedRequest,
    BatchEmbedResponseSchema,
    EmbeddingResultSchema,
    DocumentSimilarityRequest,
    DocumentSimilarityResponseSchema,
    EmbeddingStatusResponse
)
from app.core.permissions import require_permission
from app.core.exceptions import EntityNotFoundError, ServiceUnavailableError
import os

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize RAG services
def get_embedding_service() -> EmbeddingService:
    """Get embedding service instance."""
    return EmbeddingService(
        provider=EmbeddingProvider.OPENAI,
        model="text-embedding-ada-002",
        api_key=os.getenv("OPENAI_API_KEY"),
        enable_cache=True
    )

def get_vector_service() -> VectorSearchService:
    """Get vector search service instance."""
    return VectorSearchService(
        qdrant_host=os.getenv("QDRANT_HOST", "localhost"),
        qdrant_port=int(os.getenv("QDRANT_PORT", "6333")),
        qdrant_api_key=os.getenv("QDRANT_API_KEY")
    )

async def get_rag_pipeline(
    db: AsyncSession = Depends(get_db_session),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    vector_service: VectorSearchService = Depends(get_vector_service)
) -> RAGPipeline:
    """Get RAG pipeline instance."""
    # TODO: Add LLM service when implemented
    return RAGPipeline(
        embedding_service=embedding_service,
        vector_service=vector_service,
        db_session=db,
        llm_service=None  # Will be added when LLM service is implemented
    )


@router.post(
    "/documents/{document_id}/embed",
    response_model=EmbeddingResultSchema,
    summary="Process document for embedding generation",
    dependencies=[Depends(require_permission("documents:read"))]
)
async def process_document_embedding(
    document_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
) -> Dict[str, Any]:
    """
    Process a document to generate embeddings for semantic search.
    
    This endpoint:
    - Chunks the document text using legal-aware strategies
    - Generates embeddings using OpenAI's ada-002 model
    - Stores embeddings in tenant-specific Qdrant collection
    - Returns processing results and statistics
    """
    try:
        # Get document with tenant validation
        document = await db.get(Document, document_id)
        if not document or document.tenant_id != current_user.tenant_id:
            raise EntityNotFoundError("Document", document_id)
        
        # Check if document has text content
        if not document.extracted_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document has no extracted text content"
            )
        
        # Process document through RAG pipeline
        result = await rag_pipeline.process_document(document)
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": result.error_message,
                    "document_id": document_id
                }
            )
        
        logger.info(f"Successfully processed document {document_id} for embeddings")
        
        return {
            "success": result.success,
            "document_id": result.document_id,
            "chunks_processed": result.chunks_processed,
            "embeddings_generated": result.embeddings_generated,
            "processing_time": result.processing_time
        }
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found"
        )
    except Exception as e:
        logger.error(f"Failed to process document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/search",
    response_model=SemanticSearchResponseSchema,
    summary="Perform semantic search across documents",
    dependencies=[Depends(require_permission("documents:read"))]
)
async def semantic_search(
    request: SemanticSearchRequest,
    current_user: User = Depends(get_current_user),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
) -> Dict[str, Any]:
    """
    Perform semantic search across documents using vector embeddings.
    
    This endpoint:
    - Converts the query to embeddings
    - Searches tenant-specific vector collection
    - Returns ranked results with similarity scores
    - Supports filtering by document metadata
    """
    try:
        # Create search query with tenant context
        search_query = SemanticSearchQuery(
            text=request.query,
            tenant_id=current_user.tenant_id,
            limit=request.limit,
            score_threshold=request.score_threshold,
            include_metadata=request.include_metadata,
            filters=request.filters or {}
        )
        
        # Perform semantic search
        results = await rag_pipeline.semantic_search(search_query)
        
        logger.info(f"Semantic search returned {len(results.results)} results for tenant {current_user.tenant_id}")
        
        # Convert results to response format
        search_results = []
        for result in results.results:
            search_results.append({
                "score": result.score,
                "metadata": result.metadata,
                "chunk_id": result.chunk_id
            })
        
        return {
            "query": results.query,
            "results": search_results,
            "total_results": results.total_results,
            "processing_time": results.processing_time
        }
        
    except Exception as e:
        logger.error(f"Semantic search failed for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/question",
    response_model=QuestionResponseSchema,
    summary="Answer questions using RAG",
    dependencies=[Depends(require_permission("ai:query"))]
)
async def answer_question(
    request: QuestionRequest,
    current_user: User = Depends(get_current_user),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
) -> Dict[str, Any]:
    """
    Answer questions using Retrieval-Augmented Generation.
    
    This endpoint:
    - Searches for relevant document contexts
    - Uses LLM to generate answers based on retrieved context
    - Returns answer with confidence score and sources
    """
    try:
        # Check if LLM service is available
        if not rag_pipeline.llm_service:
            raise ServiceUnavailableError("LLM service not configured for question answering")
        
        # Answer question using RAG
        result = await rag_pipeline.answer_question(
            question=request.question,
            tenant_id=current_user.tenant_id,
            context_limit=request.context_limit
        )
        
        logger.info(f"Question answered for tenant {current_user.tenant_id}")
        
        return result
        
    except ServiceUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Question answering failed for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/documents/batch-embed",
    response_model=BatchEmbedResponseSchema,
    summary="Batch process multiple documents for embeddings",
    dependencies=[Depends(require_permission("documents:write"))]
)
async def batch_embed_documents(
    request: BatchEmbedRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
) -> Dict[str, Any]:
    """
    Process multiple documents for embedding generation in batch.
    
    This endpoint:
    - Validates all document IDs exist and belong to tenant
    - Processes documents in batch for efficiency
    - Returns individual results for each document
    """
    try:
        if not request.document_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Document IDs list cannot be empty"
            )
        
        # Get documents with tenant validation
        documents = []
        for doc_id in request.document_ids:
            document = await db.get(Document, doc_id)
            if not document or document.tenant_id != current_user.tenant_id:
                raise EntityNotFoundError("Document", doc_id)
            documents.append(document)
        
        # Process documents in batch
        results = await rag_pipeline.batch_process_documents(documents)
        
        # Count successful/failed results
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        logger.info(f"Batch processed {len(documents)} documents: {successful} successful, {failed} failed")
        
        # Convert results to response format
        result_data = []
        for result in results:
            result_data.append({
                "success": result.success,
                "document_id": result.document_id,
                "chunks_processed": result.chunks_processed,
                "embeddings_generated": result.embeddings_generated,
                "processing_time": result.processing_time,
                "error_message": result.error_message
            })
        
        return {
            "results": result_data,
            "total_processed": len(results),
            "successful": successful,
            "failed": failed
        }
        
    except EntityNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Batch embedding failed for tenant {current_user.tenant_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/documents/{document_id}/status",
    response_model=EmbeddingStatusResponse,
    summary="Get embedding status for a document",
    dependencies=[Depends(require_permission("documents:read"))]
)
async def get_embedding_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    vector_service: VectorSearchService = Depends(get_vector_service)
) -> Dict[str, Any]:
    """
    Get the embedding status for a specific document.
    
    Returns information about:
    - Whether document has been embedded
    - Number of chunks and embeddings
    - Last processing date
    - Collection information
    """
    try:
        # Validate document exists and belongs to tenant
        document = await db.get(Document, document_id)
        if not document or document.tenant_id != current_user.tenant_id:
            raise EntityNotFoundError("Document", document_id)
        
        # Check embedding status in vector database
        collection_name = f"tenant_{current_user.tenant_id}"
        
        # TODO: Implement get_document_status method in VectorSearchService
        # For now, return basic status
        status_info = {
            "document_id": document_id,
            "is_embedded": bool(document.extracted_text),  # Placeholder logic
            "embedding_date": document.updated_at.isoformat() if document.updated_at else None,
            "chunks_count": 0,  # Will be populated when implemented
            "last_updated": document.updated_at.isoformat() if document.updated_at else None,
            "collection_name": collection_name
        }
        
        return status_info
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found"
        )
    except Exception as e:
        logger.error(f"Failed to get embedding status for document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete(
    "/documents/{document_id}/embeddings",
    summary="Delete embeddings for a document",
    dependencies=[Depends(require_permission("documents:write"))]
)
async def delete_document_embeddings(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    vector_service: VectorSearchService = Depends(get_vector_service)
) -> Dict[str, Any]:
    """
    Delete all embeddings for a specific document.
    
    This endpoint:
    - Validates document ownership
    - Removes all embeddings from vector database
    - Returns confirmation of deletion
    """
    try:
        # Validate document exists and belongs to tenant
        document = await db.get(Document, document_id)
        if not document or document.tenant_id != current_user.tenant_id:
            raise EntityNotFoundError("Document", document_id)
        
        # Delete embeddings from vector database
        collection_name = f"tenant_{current_user.tenant_id}"
        await vector_service.delete_document_embeddings(
            collection_name=collection_name,
            document_id=document_id
        )
        
        logger.info(f"Deleted embeddings for document {document_id}")
        
        return {
            "message": "Document embeddings deleted successfully",
            "document_id": document_id
        }
        
    except EntityNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found"
        )
    except Exception as e:
        logger.error(f"Failed to delete embeddings for document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/similarity",
    response_model=DocumentSimilarityResponseSchema,
    summary="Compare document similarity using embeddings",
    dependencies=[Depends(require_permission("ai:query"))]
)
async def document_similarity(
    request: DocumentSimilarityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
) -> Dict[str, Any]:
    """
    Compare similarity between documents using their embeddings.
    
    This endpoint:
    - Validates all documents belong to the tenant
    - Compares embeddings to calculate similarity scores
    - Returns detailed similarity analysis
    """
    try:
        # Validate source document
        source_doc = await db.get(Document, request.source_document_id)
        if not source_doc or source_doc.tenant_id != current_user.tenant_id:
            raise EntityNotFoundError("Document", request.source_document_id)
        
        # Validate target documents
        target_docs = []
        for doc_id in request.target_document_ids:
            doc = await db.get(Document, doc_id)
            if not doc or doc.tenant_id != current_user.tenant_id:
                raise EntityNotFoundError("Document", doc_id)
            target_docs.append(doc)
        
        # TODO: Implement compare_documents method in RAGPipeline
        # For now, return placeholder similarity results
        similarities = []
        for i, target_doc in enumerate(target_docs):
            similarity_score = 0.8 - (i * 0.1)  # Placeholder calculation
            if similarity_score >= request.similarity_threshold:
                similarities.append({
                    "document_id": target_doc.id,
                    "similarity": similarity_score,
                    "common_chunks": 2,  # Placeholder
                    "top_matches": [
                        {"source_chunk": 0, "target_chunk": 1, "score": similarity_score}
                    ]
                })
        
        logger.info(f"Calculated similarity for {len(similarities)} document pairs")
        
        return {
            "source_document_id": request.source_document_id,
            "results": similarities
        }
        
    except EntityNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Document similarity calculation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )