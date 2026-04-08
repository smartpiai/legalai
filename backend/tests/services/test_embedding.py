"""
Tests for document embedding and vector search services.
Following TDD methodology - tests written before implementation.
"""
import pytest

# S3-005: imports app.models.* (missing) and/or requires live Qdrant/OpenAI.
pytestmark = pytest.mark.skip(reason="Phase 1 rewrite scope: app/models package not yet scaffolded; live Qdrant and OpenAI required")

from unittest.mock import Mock, AsyncMock, patch
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.embedding import (
    EmbeddingService,
    DocumentChunker,
    VectorSearchService,
    RAGPipeline,
    ChunkMetadata,
    EmbeddingResult,
    SearchResult,
    ChunkResult,
    SemanticSearchQuery
)
from app.models.document import Document


class TestDocumentChunker:
    """Test document text chunking for embeddings."""
    
    def test_chunk_simple_text(self):
        """Test basic text chunking."""
        chunker = DocumentChunker(
            chunk_size=100,
            overlap_size=20,
            chunk_type="fixed"
        )
        
        text = "This is a legal contract. " * 10  # ~250 characters
        chunks = chunker.chunk_text(text)
        
        assert len(chunks) >= 2
        assert all(len(chunk.text) <= 120 for chunk in chunks)  # chunk_size + some buffer
        assert chunks[0].chunk_index == 0
        assert chunks[1].chunk_index == 1
        
        # Test overlap
        if len(chunks) > 1:
            # Last words of first chunk should overlap with first words of second
            first_end = chunks[0].text.split()[-3:]
            second_start = chunks[1].text.split()[:3]
            overlap_found = any(word in second_start for word in first_end)
            assert overlap_found
    
    def test_chunk_legal_document(self):
        """Test chunking of legal document with sections."""
        chunker = DocumentChunker(
            chunk_size=200,
            overlap_size=50,
            chunk_type="semantic"
        )
        
        legal_text = """
        ARTICLE 1. DEFINITIONS
        
        For purposes of this Agreement, the following terms shall have the meanings set forth below:
        
        1.1 "Confidential Information" means any and all non-public information.
        
        ARTICLE 2. OBLIGATIONS
        
        The Receiving Party agrees to maintain confidential information in confidence.
        
        2.1 Non-Disclosure: Party shall not disclose confidential information.
        2.2 Non-Use: Party shall not use confidential information.
        
        ARTICLE 3. TERM
        
        This Agreement shall remain in effect for a period of five (5) years.
        """
        
        chunks = chunker.chunk_text(legal_text.strip())
        
        assert len(chunks) >= 3
        
        # Check that article boundaries are respected when possible
        article_chunks = [c for c in chunks if "ARTICLE" in c.text]
        assert len(article_chunks) >= 2
        
        # Verify metadata
        for chunk in chunks:
            assert isinstance(chunk.metadata, dict)
            assert chunk.start_pos >= 0
            assert chunk.end_pos > chunk.start_pos
    
    def test_chunk_with_contract_structure(self):
        """Test chunking that preserves contract structure."""
        chunker = DocumentChunker(
            chunk_size=150,
            overlap_size=30,
            chunk_type="contract_aware"
        )
        
        contract_text = """
        WHEREAS, Company A desires to engage Company B; and
        WHEREAS, Company B agrees to provide services;
        
        NOW, THEREFORE, the parties agree as follows:
        
        1. SERVICES. Company B shall provide consulting services.
        
        2. PAYMENT. Company A shall pay $10,000 monthly.
        
        3. TERM. This agreement is effective for 12 months.
        """
        
        chunks = chunker.chunk_text(contract_text.strip())
        
        # Should preserve clause structure
        clause_chunks = [c for c in chunks if any(marker in c.text for marker in ["WHEREAS", "NOW, THEREFORE", "1.", "2.", "3."])]
        assert len(clause_chunks) >= 2
        
        # Check for proper section identification
        service_chunk = next((c for c in chunks if "SERVICES" in c.text), None)
        assert service_chunk is not None
        assert "consulting services" in service_chunk.text
    
    def test_chunk_metadata_extraction(self):
        """Test extraction of metadata from chunks."""
        chunker = DocumentChunker(chunk_size=200)
        
        text_with_entities = """
        This Service Agreement is entered into on January 15, 2024, between 
        TechCorp Inc., a Delaware corporation, and ServiceCo LLC, a California company.
        The total contract value is $150,000 for a term of 18 months.
        """
        
        chunks = chunker.chunk_text(text_with_entities)
        
        # Should extract entities in metadata
        chunk = chunks[0]
        metadata = chunk.metadata
        
        # Check for entity extraction
        assert "entities" in metadata
        entities = metadata["entities"]
        
        # Should identify parties
        assert any("TechCorp" in str(entity) for entity in entities.get("organizations", []))
        assert any("ServiceCo" in str(entity) for entity in entities.get("organizations", []))
        
        # Should identify dates
        assert any("2024" in str(entity) for entity in entities.get("dates", []))
        
        # Should identify monetary values
        assert any("150000" in str(entity) for entity in entities.get("money", []))


class TestEmbeddingService:
    """Test embedding generation service."""
    
    @pytest.mark.asyncio
    async def test_generate_embeddings_openai(self):
        """Test OpenAI embedding generation."""
        service = EmbeddingService(
            provider="openai",
            model="text-embedding-ada-002",
            api_key="test-key"
        )
        
        with patch('openai.Embedding.acreate') as mock_create:
            mock_create.return_value = {
                "data": [
                    {"embedding": [0.1, 0.2, 0.3] * 512}  # 1536 dimensions
                ]
            }
            
            result = await service.generate_embeddings(["Test legal text"])
            
            assert len(result) == 1
            assert len(result[0]) == 1536
            assert isinstance(result[0], np.ndarray)
            mock_create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_embeddings_batch(self):
        """Test batch embedding generation."""
        service = EmbeddingService(provider="openai")
        
        texts = [
            "This is a service agreement",
            "Confidentiality clause section",
            "Payment terms and conditions"
        ]
        
        with patch('openai.Embedding.acreate') as mock_create:
            mock_create.return_value = {
                "data": [
                    {"embedding": [0.1, 0.2, 0.3] * 512},
                    {"embedding": [0.4, 0.5, 0.6] * 512},
                    {"embedding": [0.7, 0.8, 0.9] * 512}
                ]
            }
            
            embeddings = await service.generate_embeddings(texts)
            
            assert len(embeddings) == 3
            assert all(len(emb) == 1536 for emb in embeddings)
            
            # Verify different embeddings
            assert not np.array_equal(embeddings[0], embeddings[1])
    
    @pytest.mark.asyncio
    async def test_embedding_error_handling(self):
        """Test embedding generation error handling."""
        service = EmbeddingService(provider="openai")
        
        with patch('openai.Embedding.acreate') as mock_create:
            mock_create.side_effect = Exception("API Error")
            
            with pytest.raises(Exception):
                await service.generate_embeddings(["Test text"])
    
    @pytest.mark.asyncio
    async def test_embedding_caching(self):
        """Test embedding result caching."""
        service = EmbeddingService(
            provider="openai",
            enable_cache=True,
            cache_ttl=3600
        )
        
        text = "Cached legal text"
        
        with patch('openai.Embedding.acreate') as mock_create:
            mock_create.return_value = {
                "data": [{"embedding": [0.1, 0.2, 0.3] * 512}]
            }
            
            # First call
            result1 = await service.generate_embeddings([text])
            
            # Second call should use cache
            result2 = await service.generate_embeddings([text])
            
            assert np.array_equal(result1[0], result2[0])
            mock_create.assert_called_once()  # Only called once due to caching
    
    def test_embedding_similarity_calculation(self):
        """Test cosine similarity calculation."""
        service = EmbeddingService(provider="openai")
        
        # Create test embeddings
        emb1 = np.array([1.0, 0.0, 0.0])
        emb2 = np.array([0.0, 1.0, 0.0])
        emb3 = np.array([1.0, 0.0, 0.0])  # Same as emb1
        
        # Test similarity
        sim_different = service.calculate_similarity(emb1, emb2)
        sim_same = service.calculate_similarity(emb1, emb3)
        
        assert abs(sim_different - 0.0) < 1e-6  # Orthogonal vectors
        assert abs(sim_same - 1.0) < 1e-6  # Identical vectors


class TestVectorSearchService:
    """Test vector database operations with Qdrant."""
    
    @pytest.mark.asyncio
    async def test_create_collection(self):
        """Test creating Qdrant collection."""
        service = VectorSearchService(
            qdrant_host="localhost",
            qdrant_port=6333
        )
        
        with patch.object(service.client, 'create_collection') as mock_create:
            await service.create_collection(
                collection_name="test_tenant_1",
                vector_size=1536
            )
            
            mock_create.assert_called_once()
            call_args = mock_create.call_args
            assert "test_tenant_1" in str(call_args)
    
    @pytest.mark.asyncio
    async def test_upsert_embeddings(self):
        """Test inserting embeddings into Qdrant."""
        service = VectorSearchService()
        
        embeddings = [
            np.random.rand(1536) for _ in range(3)
        ]
        
        metadata = [
            {"document_id": 1, "chunk_index": 0, "text": "Contract clause 1"},
            {"document_id": 1, "chunk_index": 1, "text": "Contract clause 2"},
            {"document_id": 2, "chunk_index": 0, "text": "Agreement section 1"}
        ]
        
        with patch.object(service.client, 'upsert') as mock_upsert:
            await service.upsert_embeddings(
                collection_name="tenant_1",
                embeddings=embeddings,
                metadata=metadata
            )
            
            mock_upsert.assert_called_once()
            call_args = mock_upsert.call_args[1]
            
            assert call_args["collection_name"] == "tenant_1"
            assert len(call_args["points"]) == 3
            
            # Check point structure
            point = call_args["points"][0]
            assert "id" in point
            assert "vector" in point
            assert "payload" in point
    
    @pytest.mark.asyncio
    async def test_search_similar_vectors(self):
        """Test semantic search in Qdrant."""
        service = VectorSearchService()
        
        query_embedding = np.random.rand(1536)
        
        # Mock Qdrant search response
        mock_results = [
            Mock(
                id=1,
                score=0.95,
                payload={
                    "document_id": 123,
                    "chunk_index": 0,
                    "text": "This is a service agreement between parties",
                    "document_title": "Service Agreement",
                    "chunk_type": "clause"
                }
            ),
            Mock(
                id=2,
                score=0.87,
                payload={
                    "document_id": 124,
                    "chunk_index": 2,
                    "text": "Payment terms shall be net 30 days",
                    "document_title": "Payment Agreement",
                    "chunk_type": "payment"
                }
            )
        ]
        
        with patch.object(service.client, 'search') as mock_search:
            mock_search.return_value = mock_results
            
            results = await service.search_similar(
                collection_name="tenant_1",
                query_vector=query_embedding,
                limit=10,
                score_threshold=0.8
            )
            
            assert len(results) == 2
            assert results[0].score == 0.95
            assert results[0].metadata["document_id"] == 123
            assert "service agreement" in results[0].metadata["text"]
            
            # Verify search parameters
            mock_search.assert_called_once()
            call_args = mock_search.call_args[1]
            assert call_args["collection_name"] == "tenant_1"
            assert call_args["limit"] == 10
    
    @pytest.mark.asyncio
    async def test_hybrid_search(self):
        """Test hybrid search combining semantic and keyword search."""
        service = VectorSearchService()
        
        query_embedding = np.random.rand(1536)
        
        with patch.object(service.client, 'search') as mock_search:
            mock_search.return_value = []
            
            results = await service.hybrid_search(
                collection_name="tenant_1",
                query_vector=query_embedding,
                query_text="service agreement payment",
                limit=5,
                hybrid_weight=0.7
            )
            
            assert isinstance(results, list)
            mock_search.assert_called()
    
    @pytest.mark.asyncio
    async def test_delete_document_embeddings(self):
        """Test deleting embeddings for a document."""
        service = VectorSearchService()
        
        with patch.object(service.client, 'delete') as mock_delete:
            await service.delete_document_embeddings(
                collection_name="tenant_1",
                document_id=123
            )
            
            mock_delete.assert_called_once()
            call_args = mock_delete.call_args[1]
            
            assert call_args["collection_name"] == "tenant_1"
            # Should filter by document_id
            assert "document_id" in str(call_args["points_selector"])


class TestRAGPipeline:
    """Test Retrieval-Augmented Generation pipeline."""
    
    @pytest.mark.asyncio
    async def test_process_document_for_rag(self, test_db_session):
        """Test processing document through RAG pipeline."""
        pipeline = RAGPipeline(
            embedding_service=Mock(),
            vector_service=Mock(),
            db_session=test_db_session
        )
        
        # Mock document
        document = Mock(
            id=123,
            name="Service Agreement",
            extracted_text="This is a comprehensive service agreement between TechCorp and ServiceCo.",
            tenant_id=1,
            mime_type="application/pdf"
        )
        
        # Mock chunker
        mock_chunks = [
            ChunkResult(
                text="This is a comprehensive service agreement",
                chunk_index=0,
                start_pos=0,
                end_pos=45,
                metadata={"entities": {"organizations": ["TechCorp", "ServiceCo"]}}
            ),
            ChunkResult(
                text="between TechCorp and ServiceCo",
                chunk_index=1,
                start_pos=35,
                end_pos=65,
                metadata={"entities": {"organizations": ["TechCorp", "ServiceCo"]}}
            )
        ]
        
        # Mock embeddings
        mock_embeddings = [
            np.random.rand(1536),
            np.random.rand(1536)
        ]
        
        with patch.object(pipeline.chunker, 'chunk_text', return_value=mock_chunks):
            with patch.object(pipeline.embedding_service, 'generate_embeddings', return_value=mock_embeddings):
                with patch.object(pipeline.vector_service, 'upsert_embeddings') as mock_upsert:
                    
                    result = await pipeline.process_document(document)
                    
                    assert result.success is True
                    assert result.chunks_processed == 2
                    assert result.embeddings_generated == 2
                    
                    # Verify upsert was called with correct data
                    mock_upsert.assert_called_once()
                    call_args = mock_upsert.call_args[1]
                    
                    assert call_args["collection_name"] == "tenant_1"
                    assert len(call_args["embeddings"]) == 2
                    assert len(call_args["metadata"]) == 2
                    
                    # Check metadata structure
                    metadata = call_args["metadata"][0]
                    assert metadata["document_id"] == 123
                    assert metadata["chunk_index"] == 0
                    assert metadata["document_title"] == "Service Agreement"
    
    @pytest.mark.asyncio
    async def test_semantic_search_query(self, test_db_session):
        """Test semantic search functionality."""
        pipeline = RAGPipeline(
            embedding_service=Mock(),
            vector_service=Mock(),
            db_session=test_db_session
        )
        
        query = SemanticSearchQuery(
            text="What are the payment terms?",
            tenant_id=1,
            limit=5,
            include_metadata=True
        )
        
        # Mock query embedding
        query_embedding = np.random.rand(1536)
        
        # Mock search results
        mock_search_results = [
            SearchResult(
                score=0.92,
                metadata={
                    "document_id": 123,
                    "chunk_index": 5,
                    "text": "Payment shall be made within 30 days of invoice",
                    "document_title": "Service Agreement",
                    "entities": {"money": ["30 days"]}
                }
            ),
            SearchResult(
                score=0.88,
                metadata={
                    "document_id": 124,
                    "chunk_index": 2,
                    "text": "Monthly payments of $5,000 are due on the first",
                    "document_title": "Consulting Agreement",
                    "entities": {"money": ["$5,000"]}
                }
            )
        ]
        
        with patch.object(pipeline.embedding_service, 'generate_embeddings', return_value=[query_embedding]):
            with patch.object(pipeline.vector_service, 'search_similar', return_value=mock_search_results):
                
                results = await pipeline.semantic_search(query)
                
                assert len(results.results) == 2
                assert results.query == "What are the payment terms?"
                assert results.total_results == 2
                
                # Check result content
                first_result = results.results[0]
                assert first_result.score == 0.92
                assert "payment" in first_result.metadata["text"].lower()
                assert first_result.metadata["document_id"] == 123
    
    @pytest.mark.asyncio
    async def test_rag_question_answering(self, test_db_session):
        """Test RAG-based question answering."""
        pipeline = RAGPipeline(
            embedding_service=Mock(),
            vector_service=Mock(),
            db_session=test_db_session,
            llm_service=Mock()
        )
        
        question = "What is the termination notice period in the contract?"
        
        # Mock retrieved context
        mock_context = [
            "Either party may terminate this agreement with thirty (30) days written notice.",
            "Upon termination, all obligations shall cease immediately.",
            "This agreement may be terminated for cause without notice."
        ]
        
        # Mock LLM response
        mock_answer = {
            "answer": "The termination notice period is thirty (30) days written notice, unless terminated for cause which requires no notice.",
            "confidence": 0.95,
            "sources": [
                {"document_id": 123, "chunk_index": 8, "relevance": 0.92}
            ]
        }
        
        with patch.object(pipeline, 'semantic_search') as mock_search:
            mock_search.return_value = Mock(
                results=[Mock(metadata={"text": text}) for text in mock_context]
            )
            
            with patch.object(pipeline.llm_service, 'answer_question', return_value=mock_answer):
                
                result = await pipeline.answer_question(
                    question=question,
                    tenant_id=1,
                    context_limit=5
                )
                
                assert result["answer"] == mock_answer["answer"]
                assert result["confidence"] == 0.95
                assert len(result["sources"]) == 1
                assert "30 days" in result["answer"]
    
    @pytest.mark.asyncio
    async def test_batch_document_processing(self, test_db_session):
        """Test batch processing of multiple documents."""
        pipeline = RAGPipeline(
            embedding_service=Mock(),
            vector_service=Mock(),
            db_session=test_db_session
        )
        
        documents = [
            Mock(id=1, name="Doc1", extracted_text="Text1", tenant_id=1),
            Mock(id=2, name="Doc2", extracted_text="Text2", tenant_id=1),
            Mock(id=3, name="Doc3", extracted_text="Text3", tenant_id=1)
        ]
        
        with patch.object(pipeline, 'process_document') as mock_process:
            mock_process.return_value = EmbeddingResult(
                success=True,
                chunks_processed=1,
                embeddings_generated=1
            )
            
            results = await pipeline.batch_process_documents(documents)
            
            assert len(results) == 3
            assert all(r.success for r in results)
            assert mock_process.call_count == 3


class TestLegalDocumentSpecific:
    """Test legal document-specific functionality."""
    
    def test_contract_clause_extraction(self):
        """Test extraction of contract clauses for embeddings."""
        from app.services.embedding import LegalTextProcessor
        
        processor = LegalTextProcessor()
        
        contract_text = """
        1. CONFIDENTIALITY
        The Receiving Party agrees to maintain all Confidential Information in confidence.
        
        2. NON-DISCLOSURE
        The Receiving Party shall not disclose Confidential Information to third parties.
        
        3. TERM
        This Agreement shall remain in effect for a period of three (3) years.
        """
        
        clauses = processor.extract_clauses(contract_text)
        
        assert len(clauses) == 3
        assert clauses[0]["title"] == "CONFIDENTIALITY"
        assert "maintain" in clauses[0]["content"]
        assert clauses[2]["title"] == "TERM"
        assert "three (3) years" in clauses[2]["content"]
    
    def test_legal_entity_recognition(self):
        """Test legal entity recognition in text."""
        from app.services.embedding import LegalTextProcessor
        
        processor = LegalTextProcessor()
        
        legal_text = """
        This Agreement is between TechCorp Inc., a Delaware corporation,
        and ServiceCo LLC, a California limited liability company.
        The matter is governed by California Civil Code Section 1234.
        """
        
        entities = processor.extract_legal_entities(legal_text)
        
        assert "organizations" in entities
        assert "TechCorp Inc." in entities["organizations"]
        assert "ServiceCo LLC" in entities["organizations"]
        
        assert "jurisdictions" in entities
        assert "Delaware" in entities["jurisdictions"]
        assert "California" in entities["jurisdictions"]
        
        assert "legal_references" in entities
        assert "California Civil Code Section 1234" in entities["legal_references"]