"""
Pydantic schemas for RAG (Retrieval-Augmented Generation) API.
Defines request and response models for embedding and search operations.
"""
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime


class SemanticSearchRequest(BaseModel):
    """Request model for semantic search."""
    query: str = Field(..., min_length=1, max_length=1000, description="Search query text")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum number of results")
    score_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity score")
    include_metadata: bool = Field(default=True, description="Include chunk metadata in results")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Additional search filters")

    @validator('query')
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError('Query cannot be empty')
        return v.strip()


class SearchResultSchema(BaseModel):
    """Schema for a single search result."""
    score: float = Field(..., description="Similarity score between 0 and 1")
    metadata: Dict[str, Any] = Field(..., description="Chunk metadata including text and document info")
    chunk_id: Optional[str] = Field(None, description="Unique identifier for the chunk")


class SemanticSearchResponseSchema(BaseModel):
    """Response model for semantic search."""
    query: str = Field(..., description="Original search query")
    results: List[SearchResultSchema] = Field(..., description="List of search results")
    total_results: int = Field(..., description="Total number of results returned")
    processing_time: float = Field(..., description="Search processing time in seconds")


class QuestionRequest(BaseModel):
    """Request model for RAG-based question answering."""
    question: str = Field(..., min_length=1, max_length=1000, description="Question to answer")
    context_limit: int = Field(default=5, ge=1, le=20, description="Maximum context chunks to use")

    @validator('question')
    def validate_question(cls, v):
        if not v or not v.strip():
            raise ValueError('Question cannot be empty')
        return v.strip()


class QuestionSourceSchema(BaseModel):
    """Schema for question answer source."""
    document_id: int = Field(..., description="Source document ID")
    chunk_index: int = Field(..., description="Chunk index within document")
    relevance: float = Field(..., description="Relevance score of this source")
    text: Optional[str] = Field(None, description="Source text content")


class QuestionResponseSchema(BaseModel):
    """Response model for RAG-based question answering."""
    answer: str = Field(..., description="Generated answer to the question")
    confidence: float = Field(..., description="Confidence score between 0 and 1")
    sources: List[QuestionSourceSchema] = Field(..., description="List of source chunks used")
    processing_time: float = Field(..., description="Answer processing time in seconds")


class BatchEmbedRequest(BaseModel):
    """Request model for batch document embedding."""
    document_ids: List[int] = Field(..., min_items=1, max_items=100, description="List of document IDs to process")

    @validator('document_ids')
    def validate_document_ids(cls, v):
        if not v:
            raise ValueError('Document IDs list cannot be empty')
        # Remove duplicates while preserving order
        seen = set()
        unique_ids = []
        for doc_id in v:
            if doc_id not in seen:
                seen.add(doc_id)
                unique_ids.append(doc_id)
        return unique_ids


class EmbeddingResultSchema(BaseModel):
    """Schema for embedding processing result."""
    success: bool = Field(..., description="Whether embedding generation was successful")
    document_id: Optional[int] = Field(None, description="Document ID that was processed")
    chunks_processed: int = Field(default=0, description="Number of text chunks processed")
    embeddings_generated: int = Field(default=0, description="Number of embeddings generated")
    processing_time: float = Field(default=0.0, description="Processing time in seconds")
    error_message: Optional[str] = Field(None, description="Error message if processing failed")


class BatchEmbedResponseSchema(BaseModel):
    """Response model for batch document embedding."""
    results: List[EmbeddingResultSchema] = Field(..., description="Individual processing results")
    total_processed: int = Field(..., description="Total number of documents processed")
    successful: int = Field(..., description="Number of successfully processed documents")
    failed: int = Field(..., description="Number of failed document processing attempts")


class DocumentSimilarityRequest(BaseModel):
    """Request model for document similarity comparison."""
    source_document_id: int = Field(..., description="ID of the source document")
    target_document_ids: List[int] = Field(..., min_items=1, max_items=50, description="List of target document IDs")
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")

    @validator('target_document_ids')
    def validate_target_documents(cls, v, values):
        if not v:
            raise ValueError('Target document IDs list cannot be empty')
        
        # Check if source document is not in target list
        source_id = values.get('source_document_id')
        if source_id and source_id in v:
            raise ValueError('Source document cannot be in target documents list')
        
        # Remove duplicates
        return list(set(v))


class DocumentMatchSchema(BaseModel):
    """Schema for document chunk match."""
    source_chunk: int = Field(..., description="Source document chunk index")
    target_chunk: int = Field(..., description="Target document chunk index")
    score: float = Field(..., description="Match similarity score")


class DocumentSimilarityResultSchema(BaseModel):
    """Schema for document similarity result."""
    document_id: int = Field(..., description="Target document ID")
    similarity: float = Field(..., description="Overall similarity score")
    common_chunks: int = Field(..., description="Number of similar chunks found")
    top_matches: List[DocumentMatchSchema] = Field(..., description="Top chunk matches")


class DocumentSimilarityResponseSchema(BaseModel):
    """Response model for document similarity comparison."""
    source_document_id: int = Field(..., description="Source document ID")
    results: List[DocumentSimilarityResultSchema] = Field(..., description="Similarity results for each target document")


class EmbeddingStatusResponse(BaseModel):
    """Response model for document embedding status."""
    document_id: int = Field(..., description="Document ID")
    is_embedded: bool = Field(..., description="Whether document has been embedded")
    embedding_date: Optional[str] = Field(None, description="Date when document was embedded")
    chunks_count: int = Field(default=0, description="Number of chunks in embeddings")
    last_updated: Optional[str] = Field(None, description="Last update timestamp")
    collection_name: str = Field(..., description="Vector database collection name")


class ChunkingConfigSchema(BaseModel):
    """Schema for document chunking configuration."""
    chunk_size: int = Field(default=512, ge=100, le=2000, description="Maximum chunk size in characters")
    overlap_size: int = Field(default=50, ge=0, le=500, description="Overlap between chunks in characters")
    chunk_type: str = Field(default="semantic", description="Chunking strategy: fixed, semantic, contract_aware")

    @validator('chunk_type')
    def validate_chunk_type(cls, v):
        valid_types = ["fixed", "semantic", "contract_aware", "paragraph"]
        if v not in valid_types:
            raise ValueError(f'Chunk type must be one of: {", ".join(valid_types)}')
        return v

    @validator('overlap_size')
    def validate_overlap_size(cls, v, values):
        chunk_size = values.get('chunk_size', 512)
        if v >= chunk_size:
            raise ValueError('Overlap size must be less than chunk size')
        return v


class EmbeddingConfigRequest(BaseModel):
    """Request model for embedding configuration."""
    provider: str = Field(default="openai", description="Embedding provider")
    model: str = Field(default="text-embedding-ada-002", description="Embedding model name")
    chunking_config: ChunkingConfigSchema = Field(default_factory=ChunkingConfigSchema, description="Chunking configuration")

    @validator('provider')
    def validate_provider(cls, v):
        valid_providers = ["openai", "huggingface", "sentence_transformers"]
        if v not in valid_providers:
            raise ValueError(f'Provider must be one of: {", ".join(valid_providers)}')
        return v


class CollectionInfoSchema(BaseModel):
    """Schema for vector collection information."""
    collection_name: str = Field(..., description="Collection name")
    vector_count: int = Field(..., description="Number of vectors in collection")
    vector_size: int = Field(..., description="Dimension of vectors")
    distance_metric: str = Field(..., description="Distance metric used")
    created_at: Optional[str] = Field(None, description="Collection creation timestamp")


class RAGStatsResponseSchema(BaseModel):
    """Response model for RAG system statistics."""
    tenant_id: int = Field(..., description="Tenant ID")
    total_documents: int = Field(..., description="Total documents in tenant")
    embedded_documents: int = Field(..., description="Documents with embeddings")
    total_chunks: int = Field(..., description="Total chunks across all documents")
    collection_info: CollectionInfoSchema = Field(..., description="Vector collection information")
    last_embedding_date: Optional[str] = Field(None, description="Last embedding generation date")


class HybridSearchRequest(BaseModel):
    """Request model for hybrid search combining semantic and keyword search."""
    query: str = Field(..., min_length=1, max_length=1000, description="Search query text")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum number of results")
    semantic_weight: float = Field(default=0.7, ge=0.0, le=1.0, description="Weight for semantic search")
    keyword_weight: float = Field(default=0.3, ge=0.0, le=1.0, description="Weight for keyword search")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Additional search filters")

    @validator('semantic_weight', 'keyword_weight')
    def validate_weights(cls, v, values, field):
        if field.name == 'keyword_weight':
            semantic_weight = values.get('semantic_weight', 0.7)
            if abs((v + semantic_weight) - 1.0) > 0.01:  # Allow small floating point errors
                raise ValueError('Semantic and keyword weights must sum to 1.0')
        return v


class ReindexRequest(BaseModel):
    """Request model for reindexing documents."""
    document_ids: Optional[List[int]] = Field(None, description="Specific documents to reindex (all if None)")
    force_reprocess: bool = Field(default=False, description="Force reprocessing even if embeddings exist")
    chunking_config: Optional[ChunkingConfigSchema] = Field(None, description="New chunking configuration")


class ReindexResponseSchema(BaseModel):
    """Response model for reindexing operation."""
    task_id: str = Field(..., description="Background task ID for tracking progress")
    documents_queued: int = Field(..., description="Number of documents queued for reindexing")
    estimated_completion: Optional[str] = Field(None, description="Estimated completion time")


class HealthCheckResponseSchema(BaseModel):
    """Response model for RAG service health check."""
    status: str = Field(..., description="Overall service status")
    embedding_service: str = Field(..., description="Embedding service status")
    vector_database: str = Field(..., description="Vector database status")
    llm_service: Optional[str] = Field(None, description="LLM service status")
    last_check: str = Field(..., description="Last health check timestamp")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional health check details")