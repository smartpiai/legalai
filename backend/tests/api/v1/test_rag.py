"""
Tests for RAG (Retrieval-Augmented Generation) API endpoints.
Following TDD methodology - tests written before implementation.
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
import numpy as np
from typing import Dict, Any, List
from httpx import AsyncClient
from fastapi import status

from app.services.embedding import (
    EmbeddingResult,
    SemanticSearchResponse,
    SearchResult
)


class TestRAGEndpoints:
    """Test RAG API endpoints for embedding and search functionality."""
    
    @pytest.mark.asyncio
    async def test_process_document_embedding(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_document: Dict[str, Any]
    ):
        """Test document processing for embedding generation."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Mock successful embedding processing
        mock_result = EmbeddingResult(
            success=True,
            chunks_processed=5,
            embeddings_generated=5,
            processing_time=2.5,
            document_id=test_document["id"]
        )
        
        with patch('app.services.embedding.RAGPipeline.process_document', return_value=mock_result):
            response = await test_client.post(
                f"/api/v1/rag/documents/{test_document['id']}/embed",
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["success"] is True
        assert data["chunks_processed"] == 5
        assert data["embeddings_generated"] == 5
        assert data["document_id"] == test_document["id"]
        assert "processing_time" in data
    
    @pytest.mark.asyncio
    async def test_process_document_embedding_not_found(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test embedding processing with non-existent document."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        response = await test_client.post(
            "/api/v1/rag/documents/99999/embed",
            headers=headers
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_semantic_search(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test semantic search endpoint."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        search_request = {
            "query": "What are the payment terms in the contract?",
            "limit": 5,
            "score_threshold": 0.7,
            "include_metadata": True,
            "filters": {
                "document_type": "contract"
            }
        }
        
        # Mock search results
        mock_results = [
            SearchResult(
                score=0.95,
                metadata={
                    "document_id": 123,
                    "chunk_index": 2,
                    "text": "Payment shall be made within 30 days of invoice receipt.",
                    "document_title": "Service Agreement",
                    "entities": {"money": ["30 days"]}
                }
            ),
            SearchResult(
                score=0.87,
                metadata={
                    "document_id": 124,
                    "chunk_index": 5,
                    "text": "Monthly fees of $10,000 are due on the first business day.",
                    "document_title": "Consulting Agreement",
                    "entities": {"money": ["$10,000"]}
                }
            )
        ]
        
        mock_response = SemanticSearchResponse(
            query="What are the payment terms in the contract?",
            results=mock_results,
            total_results=2,
            processing_time=0.85
        )
        
        with patch('app.services.embedding.RAGPipeline.semantic_search', return_value=mock_response):
            response = await test_client.post(
                "/api/v1/rag/search",
                json=search_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["query"] == search_request["query"]
        assert len(data["results"]) == 2
        assert data["total_results"] == 2
        assert "processing_time" in data
        
        # Check first result
        first_result = data["results"][0]
        assert first_result["score"] == 0.95
        assert "payment" in first_result["metadata"]["text"].lower()
        assert first_result["metadata"]["document_id"] == 123
    
    @pytest.mark.asyncio
    async def test_semantic_search_empty_query(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test semantic search with empty query."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        search_request = {
            "query": "",
            "limit": 5
        }
        
        response = await test_client.post(
            "/api/v1/rag/search",
            json=search_request,
            headers=headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_semantic_search_with_filters(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test semantic search with various filters."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        search_request = {
            "query": "confidentiality agreement",
            "limit": 3,
            "score_threshold": 0.8,
            "filters": {
                "document_type": "nda",
                "date_range": {
                    "gte": "2024-01-01",
                    "lte": "2024-12-31"
                },
                "parties": ["TechCorp", "ServiceCo"]
            }
        }
        
        mock_response = SemanticSearchResponse(
            query="confidentiality agreement",
            results=[],
            total_results=0,
            processing_time=0.3
        )
        
        with patch('app.services.embedding.RAGPipeline.semantic_search', return_value=mock_response):
            response = await test_client.post(
                "/api/v1/rag/search",
                json=search_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["query"] == "confidentiality agreement"
        assert data["total_results"] == 0
    
    @pytest.mark.asyncio
    async def test_answer_question(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test RAG-based question answering."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        question_request = {
            "question": "What is the termination notice period?",
            "context_limit": 5
        }
        
        mock_answer = {
            "answer": "The termination notice period is thirty (30) days written notice.",
            "confidence": 0.92,
            "sources": [
                {
                    "document_id": 123,
                    "chunk_index": 8,
                    "relevance": 0.95,
                    "text": "Either party may terminate with thirty (30) days written notice."
                }
            ],
            "processing_time": 3.2
        }
        
        with patch('app.services.embedding.RAGPipeline.answer_question', return_value=mock_answer):
            response = await test_client.post(
                "/api/v1/rag/question",
                json=question_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert "30 days" in data["answer"]
        assert data["confidence"] == 0.92
        assert len(data["sources"]) == 1
        assert data["sources"][0]["document_id"] == 123
    
    @pytest.mark.asyncio
    async def test_answer_question_no_llm_service(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test question answering when LLM service is not configured."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        question_request = {
            "question": "What is the payment term?",
            "context_limit": 3
        }
        
        with patch('app.services.embedding.RAGPipeline.answer_question', side_effect=ValueError("LLM service not configured")):
            response = await test_client.post(
                "/api/v1/rag/question",
                json=question_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    
    @pytest.mark.asyncio
    async def test_batch_process_documents(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_documents: List[Dict[str, Any]]
    ):
        """Test batch processing of documents for embedding."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        document_ids = [doc["id"] for doc in test_documents[:3]]
        batch_request = {
            "document_ids": document_ids
        }
        
        # Mock batch processing results
        mock_results = [
            EmbeddingResult(
                success=True,
                chunks_processed=3,
                embeddings_generated=3,
                processing_time=1.5,
                document_id=doc_id
            )
            for doc_id in document_ids
        ]
        
        with patch('app.services.embedding.RAGPipeline.batch_process_documents', return_value=mock_results):
            response = await test_client.post(
                "/api/v1/rag/documents/batch-embed",
                json=batch_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data["results"]) == 3
        assert data["total_processed"] == 3
        assert data["successful"] == 3
        assert data["failed"] == 0
        
        # Check individual results
        for i, result in enumerate(data["results"]):
            assert result["success"] is True
            assert result["document_id"] == document_ids[i]
            assert result["chunks_processed"] == 3
    
    @pytest.mark.asyncio
    async def test_batch_process_empty_list(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test batch processing with empty document list."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        batch_request = {
            "document_ids": []
        }
        
        response = await test_client.post(
            "/api/v1/rag/documents/batch-embed",
            json=batch_request,
            headers=headers
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_get_embedding_status(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_document: Dict[str, Any]
    ):
        """Test getting embedding status for a document."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        # Mock document with embedding status
        mock_status = {
            "document_id": test_document["id"],
            "is_embedded": True,
            "embedding_date": "2024-01-15T10:30:00Z",
            "chunks_count": 5,
            "last_updated": "2024-01-15T10:30:00Z",
            "collection_name": f"tenant_{test_document['tenant_id']}"
        }
        
        with patch('app.services.embedding.VectorSearchService.get_document_status', return_value=mock_status):
            response = await test_client.get(
                f"/api/v1/rag/documents/{test_document['id']}/status",
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["document_id"] == test_document["id"]
        assert data["is_embedded"] is True
        assert data["chunks_count"] == 5
    
    @pytest.mark.asyncio
    async def test_delete_document_embeddings(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_document: Dict[str, Any]
    ):
        """Test deleting embeddings for a document."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        with patch('app.services.embedding.VectorSearchService.delete_document_embeddings') as mock_delete:
            response = await test_client.delete(
                f"/api/v1/rag/documents/{test_document['id']}/embeddings",
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert data["message"] == "Document embeddings deleted successfully"
        assert data["document_id"] == test_document["id"]
        
        mock_delete.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_similarity_search(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test similarity search with document comparison."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        similarity_request = {
            "source_document_id": 123,
            "target_document_ids": [124, 125, 126],
            "similarity_threshold": 0.8
        }
        
        mock_similarities = [
            {
                "document_id": 124,
                "similarity": 0.92,
                "common_chunks": 3,
                "top_matches": [
                    {"source_chunk": 0, "target_chunk": 2, "score": 0.95},
                    {"source_chunk": 1, "target_chunk": 5, "score": 0.89}
                ]
            },
            {
                "document_id": 125,
                "similarity": 0.85,
                "common_chunks": 2,
                "top_matches": [
                    {"source_chunk": 3, "target_chunk": 1, "score": 0.87}
                ]
            }
        ]
        
        with patch('app.services.embedding.RAGPipeline.compare_documents', return_value=mock_similarities):
            response = await test_client.post(
                "/api/v1/rag/similarity",
                json=similarity_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_200_OK
        
        data = response.json()
        assert len(data["results"]) == 2
        assert data["source_document_id"] == 123
        
        # Check similarity results
        first_result = data["results"][0]
        assert first_result["document_id"] == 124
        assert first_result["similarity"] == 0.92
        assert len(first_result["top_matches"]) == 2


class TestRAGTenantIsolation:
    """Test tenant isolation in RAG endpoints."""
    
    @pytest.mark.asyncio
    async def test_search_tenant_isolation(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_user_different_tenant_token: str
    ):
        """Test that search results are isolated by tenant."""
        headers_tenant_1 = {"Authorization": f"Bearer {test_user_token}"}
        headers_tenant_2 = {"Authorization": f"Bearer {test_user_different_tenant_token}"}
        
        search_request = {
            "query": "contract terms",
            "limit": 5
        }
        
        # Mock different results for different tenants
        tenant_1_results = SemanticSearchResponse(
            query="contract terms",
            results=[SearchResult(score=0.9, metadata={"document_id": 100})],
            total_results=1,
            processing_time=0.5
        )
        
        tenant_2_results = SemanticSearchResponse(
            query="contract terms",
            results=[SearchResult(score=0.9, metadata={"document_id": 200})],
            total_results=1,
            processing_time=0.5
        )
        
        with patch('app.services.embedding.RAGPipeline.semantic_search') as mock_search:
            # Test tenant 1
            mock_search.return_value = tenant_1_results
            response1 = await test_client.post(
                "/api/v1/rag/search",
                json=search_request,
                headers=headers_tenant_1
            )
            
            # Test tenant 2
            mock_search.return_value = tenant_2_results
            response2 = await test_client.post(
                "/api/v1/rag/search",
                json=search_request,
                headers=headers_tenant_2
            )
        
        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Results should be different for different tenants
        assert data1["results"][0]["metadata"]["document_id"] == 100
        assert data2["results"][0]["metadata"]["document_id"] == 200


class TestRAGErrorHandling:
    """Test error handling in RAG endpoints."""
    
    @pytest.mark.asyncio
    async def test_embedding_service_error(
        self,
        test_client: AsyncClient,
        test_user_token: str,
        test_document: Dict[str, Any]
    ):
        """Test handling of embedding service errors."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        mock_result = EmbeddingResult(
            success=False,
            error_message="OpenAI API rate limit exceeded",
            processing_time=1.0,
            document_id=test_document["id"]
        )
        
        with patch('app.services.embedding.RAGPipeline.process_document', return_value=mock_result):
            response = await test_client.post(
                f"/api/v1/rag/documents/{test_document['id']}/embed",
                headers=headers
            )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        data = response.json()
        assert data["detail"]["error"] == "OpenAI API rate limit exceeded"
        assert data["detail"]["document_id"] == test_document["id"]
    
    @pytest.mark.asyncio
    async def test_vector_database_error(
        self,
        test_client: AsyncClient,
        test_user_token: str
    ):
        """Test handling of vector database errors."""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        
        search_request = {
            "query": "test query",
            "limit": 5
        }
        
        with patch('app.services.embedding.RAGPipeline.semantic_search', side_effect=Exception("Qdrant connection failed")):
            response = await test_client.post(
                "/api/v1/rag/search",
                json=search_request,
                headers=headers
            )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        data = response.json()
        assert "Qdrant connection failed" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(
        self,
        test_client: AsyncClient
    ):
        """Test unauthorized access to RAG endpoints."""
        search_request = {
            "query": "test query",
            "limit": 5
        }
        
        response = await test_client.post(
            "/api/v1/rag/search",
            json=search_request
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED