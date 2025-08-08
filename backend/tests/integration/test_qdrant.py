"""
Integration tests for Qdrant vector database operations.
Following TDD methodology - tests written before implementation.
"""
import asyncio
import pytest
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.vector_store import (
    QdrantConnection,
    get_qdrant_client,
    create_collection,
    delete_collection,
    insert_vectors,
    search_vectors,
    update_vectors,
    delete_vectors,
    get_vector_by_id,
    batch_upsert,
    create_contract_embeddings,
    search_similar_contracts,
    search_by_metadata,
    hybrid_search
)


@pytest.fixture
async def qdrant_client():
    """Create a Qdrant client for testing."""
    client = QdrantConnection()
    await client.connect()
    
    # Clean test collections
    test_collection = "test_collection"
    try:
        await delete_collection(client, test_collection)
    except:
        pass
    
    yield client
    
    # Cleanup
    try:
        await delete_collection(client, test_collection)
    except:
        pass
    await client.close()


def generate_random_vector(dim: int = 384) -> List[float]:
    """Generate a random vector for testing."""
    return np.random.randn(dim).tolist()


class TestQdrantConnection:
    """Test Qdrant connection and basic operations."""
    
    @pytest.mark.asyncio
    async def test_qdrant_connection(self, qdrant_client: QdrantConnection):
        """Test that we can connect to Qdrant."""
        info = await qdrant_client.get_cluster_info()
        assert info is not None
        assert "version" in info or "status" in info
    
    @pytest.mark.asyncio
    async def test_create_collection(self, qdrant_client: QdrantConnection):
        """Test creating a vector collection."""
        collection_name = "test_collection"
        vector_size = 384
        
        result = await create_collection(
            qdrant_client,
            collection_name=collection_name,
            vector_size=vector_size,
            distance="Cosine"
        )
        
        assert result is True
        
        # Verify collection exists
        collections = await qdrant_client.list_collections()
        collection_names = [c["name"] for c in collections]
        assert collection_name in collection_names
    
    @pytest.mark.asyncio
    async def test_insert_vectors(self, qdrant_client: QdrantConnection):
        """Test inserting vectors with metadata."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        vectors = [
            {
                "id": "vec-1",
                "vector": generate_random_vector(384),
                "payload": {
                    "text": "Test document 1",
                    "type": "contract",
                    "tenant_id": 1
                }
            },
            {
                "id": "vec-2",
                "vector": generate_random_vector(384),
                "payload": {
                    "text": "Test document 2",
                    "type": "clause",
                    "tenant_id": 1
                }
            }
        ]
        
        result = await insert_vectors(qdrant_client, collection_name, vectors)
        assert result["status"] == "success"
        assert result["inserted_count"] == 2
    
    @pytest.mark.asyncio
    async def test_search_vectors(self, qdrant_client: QdrantConnection):
        """Test vector similarity search."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert test vectors
        base_vector = generate_random_vector(384)
        vectors = [
            {
                "id": f"search-{i}",
                "vector": base_vector if i == 0 else generate_random_vector(384),
                "payload": {"text": f"Document {i}", "score": i}
            }
            for i in range(5)
        ]
        await insert_vectors(qdrant_client, collection_name, vectors)
        
        # Search for similar vectors
        results = await search_vectors(
            qdrant_client,
            collection_name,
            query_vector=base_vector,
            limit=3
        )
        
        assert len(results) <= 3
        assert results[0]["id"] == "search-0"  # Exact match should be first
        assert results[0]["score"] >= 0.99  # Cosine similarity
    
    @pytest.mark.asyncio
    async def test_get_vector_by_id(self, qdrant_client: QdrantConnection):
        """Test retrieving vector by ID."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        vector_data = {
            "id": "get-test-1",
            "vector": generate_random_vector(384),
            "payload": {"text": "Get test document"}
        }
        await insert_vectors(qdrant_client, collection_name, [vector_data])
        
        # Get vector by ID
        result = await get_vector_by_id(qdrant_client, collection_name, "get-test-1")
        
        assert result is not None
        assert result["id"] == "get-test-1"
        assert result["payload"]["text"] == "Get test document"
    
    @pytest.mark.asyncio
    async def test_update_vectors(self, qdrant_client: QdrantConnection):
        """Test updating vector metadata."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert initial vector
        vector_data = {
            "id": "update-test-1",
            "vector": generate_random_vector(384),
            "payload": {"text": "Original text", "version": 1}
        }
        await insert_vectors(qdrant_client, collection_name, [vector_data])
        
        # Update vector
        updates = [{
            "id": "update-test-1",
            "payload": {"text": "Updated text", "version": 2}
        }]
        result = await update_vectors(qdrant_client, collection_name, updates)
        
        assert result["status"] == "success"
        
        # Verify update
        updated = await get_vector_by_id(qdrant_client, collection_name, "update-test-1")
        assert updated["payload"]["text"] == "Updated text"
        assert updated["payload"]["version"] == 2
    
    @pytest.mark.asyncio
    async def test_delete_vectors(self, qdrant_client: QdrantConnection):
        """Test deleting vectors."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert vectors
        vectors = [
            {
                "id": f"delete-{i}",
                "vector": generate_random_vector(384),
                "payload": {"text": f"Delete test {i}"}
            }
            for i in range(3)
        ]
        await insert_vectors(qdrant_client, collection_name, vectors)
        
        # Delete specific vectors
        result = await delete_vectors(
            qdrant_client,
            collection_name,
            vector_ids=["delete-0", "delete-1"]
        )
        
        assert result["status"] == "success"
        
        # Verify deletion
        remaining = await get_vector_by_id(qdrant_client, collection_name, "delete-2")
        assert remaining is not None
        
        deleted = await get_vector_by_id(qdrant_client, collection_name, "delete-0")
        assert deleted is None


class TestQdrantAdvancedOperations:
    """Test advanced Qdrant operations."""
    
    @pytest.mark.asyncio
    async def test_batch_upsert(self, qdrant_client: QdrantConnection):
        """Test batch upsert operations."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Batch insert
        batch_size = 100
        vectors = [
            {
                "id": f"batch-{i}",
                "vector": generate_random_vector(384),
                "payload": {"index": i, "batch": True}
            }
            for i in range(batch_size)
        ]
        
        result = await batch_upsert(qdrant_client, collection_name, vectors, batch_size=20)
        
        assert result["status"] == "success"
        assert result["total_inserted"] == batch_size
    
    @pytest.mark.asyncio
    async def test_search_by_metadata(self, qdrant_client: QdrantConnection):
        """Test searching with metadata filters."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert vectors with varied metadata
        vectors = [
            {
                "id": f"meta-{i}",
                "vector": generate_random_vector(384),
                "payload": {
                    "category": "contract" if i < 5 else "clause",
                    "tenant_id": 1 if i % 2 == 0 else 2,
                    "status": "active" if i < 7 else "archived"
                }
            }
            for i in range(10)
        ]
        await insert_vectors(qdrant_client, collection_name, vectors)
        
        # Search with filters
        query_vector = generate_random_vector(384)
        results = await search_by_metadata(
            qdrant_client,
            collection_name,
            query_vector=query_vector,
            filters={
                "category": "contract",
                "tenant_id": 1,
                "status": "active"
            },
            limit=10
        )
        
        # Verify all results match filters
        for result in results:
            assert result["payload"]["category"] == "contract"
            assert result["payload"]["tenant_id"] == 1
            assert result["payload"]["status"] == "active"
    
    @pytest.mark.asyncio
    async def test_hybrid_search(self, qdrant_client: QdrantConnection):
        """Test hybrid search combining vector and keyword search."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert documents with text
        documents = [
            {"id": "doc-1", "text": "Service agreement for software development"},
            {"id": "doc-2", "text": "Employment contract with confidentiality clause"},
            {"id": "doc-3", "text": "Software license agreement for enterprise"},
            {"id": "doc-4", "text": "Service level agreement for cloud services"}
        ]
        
        vectors = [
            {
                "id": doc["id"],
                "vector": generate_random_vector(384),
                "payload": {"text": doc["text"], "type": "contract"}
            }
            for doc in documents
        ]
        await insert_vectors(qdrant_client, collection_name, vectors)
        
        # Perform hybrid search
        results = await hybrid_search(
            qdrant_client,
            collection_name,
            query_vector=generate_random_vector(384),
            text_query="software agreement",
            limit=3
        )
        
        assert len(results) <= 3
        # Results should favor documents with both "software" and "agreement"
        result_texts = [r["payload"]["text"] for r in results]
        matching_docs = [t for t in result_texts if "software" in t.lower() and "agreement" in t.lower()]
        assert len(matching_docs) >= 1


class TestQdrantContractOperations:
    """Test contract-specific vector operations."""
    
    @pytest.mark.asyncio
    async def test_create_contract_embeddings(self, qdrant_client: QdrantConnection):
        """Test creating embeddings for contracts."""
        collection_name = "contracts"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        contract_data = {
            "id": "contract-123",
            "title": "Service Agreement",
            "content": "This is a service agreement between parties...",
            "chunks": [
                {"id": "chunk-1", "text": "Payment terms section..."},
                {"id": "chunk-2", "text": "Liability section..."},
                {"id": "chunk-3", "text": "Termination clause..."}
            ],
            "metadata": {
                "tenant_id": 1,
                "created_date": "2024-01-01",
                "contract_type": "service"
            }
        }
        
        result = await create_contract_embeddings(
            qdrant_client,
            collection_name,
            contract_data,
            embedding_function=lambda text: generate_random_vector(384)
        )
        
        assert result["status"] == "success"
        assert result["chunks_embedded"] == 3
        assert result["contract_id"] == "contract-123"
    
    @pytest.mark.asyncio
    async def test_search_similar_contracts(self, qdrant_client: QdrantConnection):
        """Test finding similar contracts."""
        collection_name = "contracts"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Create multiple contracts
        for i in range(5):
            contract_data = {
                "id": f"contract-{i}",
                "title": f"Contract {i}",
                "content": f"Contract content {i}",
                "chunks": [
                    {"id": f"c{i}-chunk-1", "text": f"Section 1 of contract {i}"}
                ],
                "metadata": {
                    "tenant_id": 1,
                    "contract_type": "service" if i < 3 else "employment"
                }
            }
            await create_contract_embeddings(
                qdrant_client,
                collection_name,
                contract_data,
                embedding_function=lambda text: generate_random_vector(384)
            )
        
        # Search for similar contracts
        query_vector = generate_random_vector(384)
        similar = await search_similar_contracts(
            qdrant_client,
            collection_name,
            query_vector=query_vector,
            tenant_id=1,
            contract_type="service",
            limit=5
        )
        
        assert len(similar) <= 3  # Should only return service contracts
        for contract in similar:
            assert contract["metadata"]["contract_type"] == "service"
            assert contract["metadata"]["tenant_id"] == 1


class TestQdrantMultiTenancy:
    """Test multi-tenant vector isolation."""
    
    @pytest.mark.asyncio
    async def test_tenant_vector_isolation(self, qdrant_client: QdrantConnection):
        """Test that tenant data is properly isolated."""
        collection_name = "test_collection"
        await create_collection(qdrant_client, collection_name, vector_size=384)
        
        # Insert vectors for different tenants
        vectors = []
        for tenant_id in [1, 2]:
            for i in range(3):
                vectors.append({
                    "id": f"tenant{tenant_id}-vec{i}",
                    "vector": generate_random_vector(384),
                    "payload": {
                        "tenant_id": tenant_id,
                        "text": f"Tenant {tenant_id} document {i}"
                    }
                })
        
        await insert_vectors(qdrant_client, collection_name, vectors)
        
        # Search within tenant 1
        results = await search_by_metadata(
            qdrant_client,
            collection_name,
            query_vector=generate_random_vector(384),
            filters={"tenant_id": 1},
            limit=10
        )
        
        # Verify only tenant 1 results
        assert all(r["payload"]["tenant_id"] == 1 for r in results)
        assert len(results) == 3