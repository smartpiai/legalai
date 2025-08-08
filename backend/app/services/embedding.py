"""
Document embedding and vector search services for RAG implementation.
Handles text chunking, embedding generation, and semantic search.
"""
import re
import asyncio
import hashlib
import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

import openai
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, Range
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ChunkType(str, Enum):
    """Types of text chunking strategies."""
    FIXED = "fixed"
    SEMANTIC = "semantic"
    CONTRACT_AWARE = "contract_aware"
    PARAGRAPH = "paragraph"


class EmbeddingProvider(str, Enum):
    """Supported embedding providers."""
    OPENAI = "openai"
    HUGGINGFACE = "huggingface"
    SENTENCE_TRANSFORMERS = "sentence_transformers"


@dataclass
class ChunkMetadata:
    """Metadata for a text chunk."""
    entities: Dict[str, List[str]] = field(default_factory=dict)
    keywords: List[str] = field(default_factory=list)
    chunk_type: str = "general"
    section_title: Optional[str] = None
    clause_number: Optional[str] = None
    legal_concepts: List[str] = field(default_factory=list)


@dataclass
class ChunkResult:
    """Result of text chunking operation."""
    text: str
    chunk_index: int
    start_pos: int
    end_pos: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Ensure metadata is properly structured."""
        if not isinstance(self.metadata, dict):
            self.metadata = {}


@dataclass
class EmbeddingResult:
    """Result of document embedding processing."""
    success: bool
    chunks_processed: int = 0
    embeddings_generated: int = 0
    processing_time: float = 0.0
    error_message: Optional[str] = None
    document_id: Optional[int] = None


@dataclass
class SearchResult:
    """Result from vector search."""
    score: float
    metadata: Dict[str, Any]
    chunk_id: Optional[str] = None
    document_id: Optional[int] = None


@dataclass
class SemanticSearchQuery:
    """Query for semantic search."""
    text: str
    tenant_id: int
    limit: int = 10
    score_threshold: float = 0.7
    include_metadata: bool = True
    filters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SemanticSearchResponse:
    """Response from semantic search."""
    query: str
    results: List[SearchResult]
    total_results: int
    processing_time: float
    query_embedding: Optional[np.ndarray] = None


class LegalTextProcessor:
    """Processor for legal document-specific text analysis."""
    
    def __init__(self):
        """Initialize legal text processor."""
        # Common legal section patterns
        self.section_patterns = [
            r'^\s*(\d+\.?\s*[A-Z][A-Z\s]+\.?)\s*$',  # "1. DEFINITIONS"
            r'^\s*(ARTICLE\s+[IVXLC\d]+\.?\s*[A-Z][A-Z\s]+\.?)\s*$',  # "ARTICLE I. DEFINITIONS"
            r'^\s*([A-Z][A-Z\s]{3,}\.?)\s*$',  # "CONFIDENTIALITY"
        ]
        
        # Legal entity patterns
        self.entity_patterns = {
            'organizations': [
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|LLC|Corp|Corporation|Company|Ltd|Limited)\b',
                r'\b([A-Z][A-Z\s]+(?:INC|LLC|CORP|CORPORATION|COMPANY|LTD|LIMITED))\b'
            ],
            'jurisdictions': [
                r'\b(Delaware|California|New York|Texas|Florida|Nevada)\b',
                r'\bState of\s+([A-Z][a-z]+)\b',
                r'\b([A-Z][a-z]+)\s+(?:law|jurisdiction|court)\b'
            ],
            'legal_references': [
                r'\b([A-Z][a-z]+\s+(?:Civil\s+)?Code\s+Section\s+\d+(?:\.\d+)*)\b',
                r'\b(\d+\s+U\.S\.C\.?\s+§?\s*\d+(?:\.\d+)*)\b',
                r'\b(Rule\s+\d+(?:\.\d+)*\s+of\s+[^.]+)\b'
            ]
        }
    
    def extract_clauses(self, text: str) -> List[Dict[str, Any]]:
        """Extract contract clauses from text."""
        clauses = []
        
        # Split by numbered sections
        sections = re.split(r'\n\s*(\d+\.?\s*[A-Z][A-Z\s]+\.?)\s*\n', text)
        
        for i in range(1, len(sections), 2):
            if i + 1 < len(sections):
                title = sections[i].strip()
                content = sections[i + 1].strip()
                
                clauses.append({
                    "title": re.sub(r'^\d+\.?\s*', '', title),
                    "content": content,
                    "section_number": re.match(r'^(\d+)', title).group(1) if re.match(r'^(\d+)', title) else None
                })
        
        return clauses
    
    def extract_legal_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract legal entities from text."""
        entities = {}
        
        for entity_type, patterns in self.entity_patterns.items():
            found_entities = []
            
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if isinstance(matches[0] if matches else None, tuple):
                    matches = [m[0] if m[0] else m[1] for m in matches]
                found_entities.extend(matches)
            
            # Remove duplicates and clean up
            entities[entity_type] = list(set(entity.strip() for entity in found_entities))
        
        return entities


class DocumentChunker:
    """Chunks documents into smaller pieces for embedding."""
    
    def __init__(
        self,
        chunk_size: int = 512,
        overlap_size: int = 50,
        chunk_type: ChunkType = ChunkType.FIXED
    ):
        """Initialize document chunker."""
        self.chunk_size = chunk_size
        self.overlap_size = overlap_size
        self.chunk_type = chunk_type
        self.legal_processor = LegalTextProcessor()
    
    def chunk_text(self, text: str) -> List[ChunkResult]:
        """Chunk text based on configured strategy."""
        if self.chunk_type == ChunkType.SEMANTIC:
            return self._chunk_semantic(text)
        elif self.chunk_type == ChunkType.CONTRACT_AWARE:
            return self._chunk_contract_aware(text)
        elif self.chunk_type == ChunkType.PARAGRAPH:
            return self._chunk_by_paragraphs(text)
        else:
            return self._chunk_fixed_size(text)
    
    def _chunk_fixed_size(self, text: str) -> List[ChunkResult]:
        """Chunk text into fixed-size pieces with overlap."""
        chunks = []
        words = text.split()
        
        if not words:
            return chunks
        
        # Estimate words per chunk (rough approximation)
        words_per_chunk = max(1, self.chunk_size // 6)  # ~6 chars per word average
        overlap_words = max(0, self.overlap_size // 6)
        
        start_idx = 0
        chunk_index = 0
        
        while start_idx < len(words):
            end_idx = min(start_idx + words_per_chunk, len(words))
            chunk_words = words[start_idx:end_idx]
            
            if not chunk_words:
                break
            
            chunk_text = " ".join(chunk_words)
            
            # Calculate character positions
            start_pos = len(" ".join(words[:start_idx]))
            if start_idx > 0:
                start_pos += 1  # Account for space
            end_pos = start_pos + len(chunk_text)
            
            # Extract metadata
            metadata = self._extract_chunk_metadata(chunk_text)
            
            chunks.append(ChunkResult(
                text=chunk_text,
                chunk_index=chunk_index,
                start_pos=start_pos,
                end_pos=end_pos,
                metadata=metadata
            ))
            
            chunk_index += 1
            
            # Move start index with overlap
            start_idx = max(start_idx + 1, end_idx - overlap_words)
            
            if start_idx >= len(words):
                break
        
        return chunks
    
    def _chunk_semantic(self, text: str) -> List[ChunkResult]:
        """Chunk text based on semantic boundaries (paragraphs, sections)."""
        chunks = []
        
        # Split by double newlines (paragraphs) first
        paragraphs = re.split(r'\n\s*\n', text.strip())
        
        current_chunk = ""
        chunk_index = 0
        start_pos = 0
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # Check if adding this paragraph exceeds chunk size
            potential_chunk = current_chunk + ("\n\n" if current_chunk else "") + paragraph
            
            if len(potential_chunk) <= self.chunk_size or not current_chunk:
                current_chunk = potential_chunk
            else:
                # Finalize current chunk
                if current_chunk:
                    end_pos = start_pos + len(current_chunk)
                    metadata = self._extract_chunk_metadata(current_chunk)
                    
                    chunks.append(ChunkResult(
                        text=current_chunk,
                        chunk_index=chunk_index,
                        start_pos=start_pos,
                        end_pos=end_pos,
                        metadata=metadata
                    ))
                    
                    chunk_index += 1
                    start_pos = end_pos + 2  # Account for paragraph separation
                
                # Start new chunk with current paragraph
                current_chunk = paragraph
        
        # Add final chunk
        if current_chunk:
            end_pos = start_pos + len(current_chunk)
            metadata = self._extract_chunk_metadata(current_chunk)
            
            chunks.append(ChunkResult(
                text=current_chunk,
                chunk_index=chunk_index,
                start_pos=start_pos,
                end_pos=end_pos,
                metadata=metadata
            ))
        
        return chunks
    
    def _chunk_contract_aware(self, text: str) -> List[ChunkResult]:
        """Chunk text while preserving contract structure."""
        chunks = []
        
        # Extract clauses first
        clauses = self.legal_processor.extract_clauses(text)
        
        if clauses:
            # Chunk based on clauses
            current_pos = 0
            
            for i, clause in enumerate(clauses):
                full_text = f"{clause.get('section_number', '')} {clause['title']}\n{clause['content']}"
                
                metadata = self._extract_chunk_metadata(full_text)
                metadata.update({
                    "clause_title": clause["title"],
                    "section_number": clause.get("section_number"),
                    "chunk_type": "contract_clause"
                })
                
                chunks.append(ChunkResult(
                    text=full_text,
                    chunk_index=i,
                    start_pos=current_pos,
                    end_pos=current_pos + len(full_text),
                    metadata=metadata
                ))
                
                current_pos += len(full_text) + 2
        else:
            # Fall back to semantic chunking
            chunks = self._chunk_semantic(text)
        
        return chunks
    
    def _chunk_by_paragraphs(self, text: str) -> List[ChunkResult]:
        """Chunk text by paragraphs, combining small ones."""
        chunks = []
        paragraphs = re.split(r'\n\s*\n', text.strip())
        
        current_chunk = ""
        chunk_index = 0
        start_pos = 0
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            if not current_chunk:
                current_chunk = paragraph
            elif len(current_chunk) + len(paragraph) + 2 <= self.chunk_size:
                current_chunk += "\n\n" + paragraph
            else:
                # Finalize current chunk
                end_pos = start_pos + len(current_chunk)
                metadata = self._extract_chunk_metadata(current_chunk)
                
                chunks.append(ChunkResult(
                    text=current_chunk,
                    chunk_index=chunk_index,
                    start_pos=start_pos,
                    end_pos=end_pos,
                    metadata=metadata
                ))
                
                chunk_index += 1
                start_pos = end_pos + 2
                current_chunk = paragraph
        
        # Add final chunk
        if current_chunk:
            end_pos = start_pos + len(current_chunk)
            metadata = self._extract_chunk_metadata(current_chunk)
            
            chunks.append(ChunkResult(
                text=current_chunk,
                chunk_index=chunk_index,
                start_pos=start_pos,
                end_pos=end_pos,
                metadata=metadata
            ))
        
        return chunks
    
    def _extract_chunk_metadata(self, text: str) -> Dict[str, Any]:
        """Extract metadata from chunk text."""
        metadata = {
            "entities": self.legal_processor.extract_legal_entities(text),
            "length": len(text),
            "word_count": len(text.split()),
            "has_numbers": bool(re.search(r'\d+', text)),
            "has_monetary": bool(re.search(r'\$[\d,]+(?:\.\d{2})?', text)),
            "has_dates": bool(re.search(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b', text))
        }
        
        return metadata


class EmbeddingService:
    """Service for generating text embeddings."""
    
    def __init__(
        self,
        provider: EmbeddingProvider = EmbeddingProvider.OPENAI,
        model: str = "text-embedding-ada-002",
        api_key: Optional[str] = None,
        enable_cache: bool = True,
        cache_ttl: int = 3600
    ):
        """Initialize embedding service."""
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.enable_cache = enable_cache
        self.cache_ttl = cache_ttl
        self._cache = {} if enable_cache else None
        
        if provider == EmbeddingProvider.OPENAI:
            openai.api_key = api_key or openai.api_key
    
    async def generate_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
        
        # Check cache first
        if self.enable_cache:
            cached_results = []
            uncached_texts = []
            uncached_indices = []
            
            for i, text in enumerate(texts):
                cache_key = self._get_cache_key(text)
                if cache_key in self._cache:
                    cached_results.append((i, self._cache[cache_key]))
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)
            
            if uncached_texts:
                # Generate embeddings for uncached texts
                new_embeddings = await self._generate_embeddings_batch(uncached_texts)
                
                # Cache results
                for text, embedding in zip(uncached_texts, new_embeddings):
                    cache_key = self._get_cache_key(text)
                    self._cache[cache_key] = embedding
                
                # Combine cached and new results
                all_embeddings = [None] * len(texts)
                
                # Set cached results
                for idx, embedding in cached_results:
                    all_embeddings[idx] = embedding
                
                # Set new results
                for i, embedding in enumerate(new_embeddings):
                    all_embeddings[uncached_indices[i]] = embedding
                
                return all_embeddings
            else:
                # All results were cached
                return [embedding for _, embedding in sorted(cached_results)]
        else:
            return await self._generate_embeddings_batch(texts)
    
    async def _generate_embeddings_batch(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings using the configured provider."""
        if self.provider == EmbeddingProvider.OPENAI:
            return await self._generate_openai_embeddings(texts)
        else:
            raise NotImplementedError(f"Provider {self.provider} not implemented")
    
    async def _generate_openai_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings using OpenAI API."""
        try:
            response = await openai.Embedding.acreate(
                input=texts,
                model=self.model
            )
            
            embeddings = []
            for item in response['data']:
                embedding = np.array(item['embedding'], dtype=np.float32)
                embeddings.append(embedding)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise
    
    def calculate_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings."""
        # Normalize embeddings
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        # Cosine similarity
        similarity = np.dot(embedding1, embedding2) / (norm1 * norm2)
        return float(similarity)
    
    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        return hashlib.md5(f"{self.model}:{text}".encode()).hexdigest()


class VectorSearchService:
    """Service for vector database operations with Qdrant."""
    
    def __init__(
        self,
        qdrant_host: str = "localhost",
        qdrant_port: int = 6333,
        qdrant_api_key: Optional[str] = None
    ):
        """Initialize vector search service."""
        self.client = QdrantClient(
            host=qdrant_host,
            port=qdrant_port,
            api_key=qdrant_api_key
        )
    
    async def create_collection(
        self,
        collection_name: str,
        vector_size: int = 1536,
        distance: Distance = Distance.COSINE
    ):
        """Create a new collection in Qdrant."""
        try:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=distance
                )
            )
            logger.info(f"Created collection: {collection_name}")
        except Exception as e:
            logger.error(f"Failed to create collection {collection_name}: {e}")
            raise
    
    async def upsert_embeddings(
        self,
        collection_name: str,
        embeddings: List[np.ndarray],
        metadata: List[Dict[str, Any]]
    ):
        """Insert or update embeddings in the collection."""
        if len(embeddings) != len(metadata):
            raise ValueError("Embeddings and metadata lists must have same length")
        
        points = []
        for i, (embedding, meta) in enumerate(zip(embeddings, metadata)):
            point_id = f"{meta.get('document_id', 0)}_{meta.get('chunk_index', i)}"
            
            points.append(PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload=meta
            ))
        
        try:
            self.client.upsert(
                collection_name=collection_name,
                points=points
            )
            logger.info(f"Upserted {len(points)} points to {collection_name}")
        except Exception as e:
            logger.error(f"Failed to upsert to {collection_name}: {e}")
            raise
    
    async def search_similar(
        self,
        collection_name: str,
        query_vector: np.ndarray,
        limit: int = 10,
        score_threshold: float = 0.7,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """Search for similar vectors."""
        try:
            # Build filter if provided
            search_filter = None
            if filters:
                conditions = []
                for key, value in filters.items():
                    if isinstance(value, (list, tuple)):
                        # IN condition
                        conditions.append(FieldCondition(
                            key=key,
                            match={"any": value}
                        ))
                    elif isinstance(value, dict) and ("gte" in value or "lte" in value):
                        # Range condition
                        conditions.append(FieldCondition(
                            key=key,
                            range=Range(**value)
                        ))
                    else:
                        # Exact match
                        conditions.append(FieldCondition(
                            key=key,
                            match={"value": value}
                        ))
                
                if conditions:
                    search_filter = Filter(must=conditions)
            
            results = self.client.search(
                collection_name=collection_name,
                query_vector=query_vector.tolist(),
                limit=limit,
                score_threshold=score_threshold,
                query_filter=search_filter
            )
            
            search_results = []
            for result in results:
                search_results.append(SearchResult(
                    score=result.score,
                    metadata=result.payload,
                    chunk_id=str(result.id)
                ))
            
            return search_results
            
        except Exception as e:
            logger.error(f"Search failed in {collection_name}: {e}")
            raise
    
    async def hybrid_search(
        self,
        collection_name: str,
        query_vector: np.ndarray,
        query_text: str,
        limit: int = 10,
        hybrid_weight: float = 0.7
    ) -> List[SearchResult]:
        """Perform hybrid search combining semantic and keyword search."""
        # For now, implement as semantic search
        # In a full implementation, this would combine with full-text search
        return await self.search_similar(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit
        )
    
    async def delete_document_embeddings(
        self,
        collection_name: str,
        document_id: int
    ):
        """Delete all embeddings for a specific document."""
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {
                                "key": "document_id",
                                "match": {"value": document_id}
                            }
                        ]
                    }
                }
            )
            logger.info(f"Deleted embeddings for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to delete embeddings for document {document_id}: {e}")
            raise


class RAGPipeline:
    """Retrieval-Augmented Generation pipeline."""
    
    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_service: VectorSearchService,
        db_session: AsyncSession,
        llm_service: Optional[Any] = None
    ):
        """Initialize RAG pipeline."""
        self.embedding_service = embedding_service
        self.vector_service = vector_service
        self.db_session = db_session
        self.llm_service = llm_service
        self.chunker = DocumentChunker()
    
    async def process_document(self, document) -> EmbeddingResult:
        """Process a document through the RAG pipeline."""
        start_time = datetime.now()
        
        try:
            # Chunk the document text
            chunks = self.chunker.chunk_text(document.extracted_text)
            
            if not chunks:
                return EmbeddingResult(
                    success=False,
                    error_message="No chunks generated from document"
                )
            
            # Generate embeddings for chunks
            chunk_texts = [chunk.text for chunk in chunks]
            embeddings = await self.embedding_service.generate_embeddings(chunk_texts)
            
            # Prepare metadata for vector storage
            metadata_list = []
            for i, chunk in enumerate(chunks):
                meta = {
                    "document_id": document.id,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "document_title": document.name,
                    "document_type": document.mime_type,
                    "start_pos": chunk.start_pos,
                    "end_pos": chunk.end_pos,
                    "tenant_id": document.tenant_id,
                    **chunk.metadata
                }
                metadata_list.append(meta)
            
            # Store in vector database
            collection_name = f"tenant_{document.tenant_id}"
            await self.vector_service.upsert_embeddings(
                collection_name=collection_name,
                embeddings=embeddings,
                metadata=metadata_list
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return EmbeddingResult(
                success=True,
                chunks_processed=len(chunks),
                embeddings_generated=len(embeddings),
                processing_time=processing_time,
                document_id=document.id
            )
            
        except Exception as e:
            logger.error(f"Failed to process document {document.id}: {e}")
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return EmbeddingResult(
                success=False,
                error_message=str(e),
                processing_time=processing_time,
                document_id=document.id
            )
    
    async def semantic_search(self, query: SemanticSearchQuery) -> SemanticSearchResponse:
        """Perform semantic search."""
        start_time = datetime.now()
        
        # Generate query embedding
        query_embeddings = await self.embedding_service.generate_embeddings([query.text])
        query_embedding = query_embeddings[0]
        
        # Search vector database
        collection_name = f"tenant_{query.tenant_id}"
        search_results = await self.vector_service.search_similar(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=query.limit,
            score_threshold=query.score_threshold,
            filters=query.filters
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return SemanticSearchResponse(
            query=query.text,
            results=search_results,
            total_results=len(search_results),
            processing_time=processing_time,
            query_embedding=query_embedding if query.include_metadata else None
        )
    
    async def answer_question(
        self,
        question: str,
        tenant_id: int,
        context_limit: int = 5
    ) -> Dict[str, Any]:
        """Answer a question using RAG."""
        if not self.llm_service:
            raise ValueError("LLM service not configured for question answering")
        
        # Search for relevant context
        search_query = SemanticSearchQuery(
            text=question,
            tenant_id=tenant_id,
            limit=context_limit
        )
        
        search_response = await self.semantic_search(search_query)
        
        # Extract context texts
        context_texts = [result.metadata["text"] for result in search_response.results]
        
        # Generate answer using LLM
        answer_result = await self.llm_service.answer_question(
            question=question,
            context=context_texts
        )
        
        return answer_result
    
    async def batch_process_documents(self, documents: List[Any]) -> List[EmbeddingResult]:
        """Process multiple documents in batch."""
        results = []
        
        for document in documents:
            result = await self.process_document(document)
            results.append(result)
        
        return results