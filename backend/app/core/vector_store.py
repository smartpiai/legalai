"""
Qdrant vector database implementation for embeddings and similarity search.
"""
import os
from typing import Dict, List, Any, Optional, Union, Callable
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition,
    MatchValue, SearchRequest, UpdateStatus, CollectionStatus
)
from app.core.config import settings


class QdrantConnection:
    """Qdrant client wrapper for vector operations."""
    
    def __init__(self, host: Optional[str] = None, port: Optional[int] = None):
        """Initialize Qdrant connection parameters."""
        self.host = host or settings.QDRANT_HOST
        self.port = port or settings.QDRANT_PORT
        self.client: Optional[QdrantClient] = None
    
    async def connect(self) -> None:
        """Establish connection to Qdrant."""
        if not self.client:
            self.client = QdrantClient(host=self.host, port=self.port)
    
    async def close(self) -> None:
        """Close Qdrant connection."""
        if self.client:
            self.client.close()
    
    async def get_cluster_info(self) -> Dict[str, Any]:
        """Get Qdrant cluster information."""
        try:
            info = self.client.get_collections()
            return {"status": "healthy", "collections": len(info.collections)}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def list_collections(self) -> List[Dict[str, Any]]:
        """List all collections."""
        collections = self.client.get_collections()
        return [{"name": c.name} for c in collections.collections]


_qdrant_client: Optional[QdrantConnection] = None


async def get_qdrant_client() -> QdrantConnection:
    """Get Qdrant client singleton."""
    global _qdrant_client
    if not _qdrant_client:
        _qdrant_client = QdrantConnection()
        await _qdrant_client.connect()
    return _qdrant_client


async def create_collection(
    client: QdrantConnection,
    collection_name: str,
    vector_size: int,
    distance: str = "Cosine"
) -> bool:
    """
    Create a new vector collection.
    
    Args:
        client: Qdrant connection
        collection_name: Name of the collection
        vector_size: Dimension of vectors
        distance: Distance metric (Cosine, Euclid, Dot)
        
    Returns:
        True if successful
    """
    distance_map = {
        "Cosine": Distance.COSINE,
        "Euclid": Distance.EUCLID,
        "Dot": Distance.DOT
    }
    
    client.client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(
            size=vector_size,
            distance=distance_map.get(distance, Distance.COSINE)
        )
    )
    return True


async def delete_collection(client: QdrantConnection, collection_name: str) -> bool:
    """Delete a collection."""
    client.client.delete_collection(collection_name=collection_name)
    return True


async def insert_vectors(
    client: QdrantConnection,
    collection_name: str,
    vectors: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Insert vectors with metadata.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        vectors: List of dicts with id, vector, and payload
        
    Returns:
        Insertion result
    """
    points = [
        PointStruct(
            id=v["id"],
            vector=v["vector"],
            payload=v.get("payload", {})
        )
        for v in vectors
    ]
    
    result = client.client.upsert(
        collection_name=collection_name,
        points=points
    )
    
    return {
        "status": "success" if result.status == UpdateStatus.COMPLETED else "failed",
        "inserted_count": len(vectors)
    }


async def search_vectors(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    limit: int = 10,
    score_threshold: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Search for similar vectors.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        query_vector: Query vector
        limit: Maximum results
        score_threshold: Minimum similarity score
        
    Returns:
        List of similar vectors with scores
    """
    results = client.client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=limit,
        score_threshold=score_threshold
    )
    
    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": hit.payload
        }
        for hit in results
    ]


async def get_vector_by_id(
    client: QdrantConnection,
    collection_name: str,
    vector_id: str
) -> Optional[Dict[str, Any]]:
    """
    Get vector by ID.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        vector_id: Vector ID
        
    Returns:
        Vector data or None
    """
    try:
        result = client.client.retrieve(
            collection_name=collection_name,
            ids=[vector_id]
        )
        if result:
            point = result[0]
            return {
                "id": point.id,
                "vector": point.vector,
                "payload": point.payload
            }
    except:
        pass
    return None


async def update_vectors(
    client: QdrantConnection,
    collection_name: str,
    updates: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Update vector metadata.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        updates: List of dicts with id and payload
        
    Returns:
        Update result
    """
    for update in updates:
        client.client.set_payload(
            collection_name=collection_name,
            payload=update["payload"],
            points=[update["id"]]
        )
    
    return {"status": "success"}


async def delete_vectors(
    client: QdrantConnection,
    collection_name: str,
    vector_ids: List[str]
) -> Dict[str, Any]:
    """
    Delete vectors by IDs.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        vector_ids: List of vector IDs to delete
        
    Returns:
        Deletion result
    """
    client.client.delete(
        collection_name=collection_name,
        points_selector=vector_ids
    )
    
    return {"status": "success"}


async def batch_upsert(
    client: QdrantConnection,
    collection_name: str,
    vectors: List[Dict[str, Any]],
    batch_size: int = 100
) -> Dict[str, Any]:
    """
    Batch upsert vectors.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        vectors: List of vectors to insert
        batch_size: Batch size for insertion
        
    Returns:
        Batch insertion result
    """
    total_inserted = 0
    
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        result = await insert_vectors(client, collection_name, batch)
        total_inserted += result["inserted_count"]
    
    return {
        "status": "success",
        "total_inserted": total_inserted
    }


async def search_by_metadata(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    filters: Dict[str, Any],
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search with metadata filters.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        query_vector: Query vector
        filters: Metadata filters
        limit: Maximum results
        
    Returns:
        Filtered search results
    """
    must_conditions = [
        FieldCondition(
            key=key,
            match=MatchValue(value=value)
        )
        for key, value in filters.items()
    ]
    
    query_filter = Filter(must=must_conditions)
    
    results = client.client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        query_filter=query_filter,
        limit=limit
    )
    
    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": hit.payload
        }
        for hit in results
    ]


async def hybrid_search(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    text_query: str,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Hybrid search combining vector and text search.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        query_vector: Query vector
        text_query: Text query for filtering
        limit: Maximum results
        
    Returns:
        Hybrid search results
    """
    # Simple text filtering - in production, use proper text search
    words = text_query.lower().split()
    
    # First do vector search
    vector_results = await search_vectors(client, collection_name, query_vector, limit * 2)
    
    # Filter by text matches
    filtered_results = []
    for result in vector_results:
        text = result.get("payload", {}).get("text", "").lower()
        if any(word in text for word in words):
            filtered_results.append(result)
    
    return filtered_results[:limit]


async def create_contract_embeddings(
    client: QdrantConnection,
    collection_name: str,
    contract_data: Dict[str, Any],
    embedding_function: Callable[[str], List[float]]
) -> Dict[str, Any]:
    """
    Create embeddings for contract chunks.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        contract_data: Contract data with chunks
        embedding_function: Function to generate embeddings
        
    Returns:
        Embedding creation result
    """
    vectors = []
    
    for chunk in contract_data.get("chunks", []):
        vector = embedding_function(chunk["text"])
        vectors.append({
            "id": chunk["id"],
            "vector": vector,
            "payload": {
                "contract_id": contract_data["id"],
                "text": chunk["text"],
                **contract_data.get("metadata", {})
            }
        })
    
    result = await insert_vectors(client, collection_name, vectors)
    
    return {
        "status": "success",
        "contract_id": contract_data["id"],
        "chunks_embedded": len(vectors)
    }


async def search_similar_contracts(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    tenant_id: int,
    contract_type: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search for similar contracts within a tenant.
    
    Args:
        client: Qdrant connection
        collection_name: Collection name
        query_vector: Query vector
        tenant_id: Tenant ID for filtering
        contract_type: Optional contract type filter
        limit: Maximum results
        
    Returns:
        Similar contracts
    """
    filters = {"tenant_id": tenant_id}
    if contract_type:
        filters["contract_type"] = contract_type
    
    results = await search_by_metadata(
        client,
        collection_name,
        query_vector,
        filters,
        limit
    )
    
    # Group by contract_id and return unique contracts
    contracts = {}
    for result in results:
        contract_id = result["payload"].get("contract_id")
        if contract_id and contract_id not in contracts:
            contracts[contract_id] = {
                "id": contract_id,
                "score": result["score"],
                "metadata": {
                    k: v for k, v in result["payload"].items()
                    if k not in ["text", "contract_id"]
                }
            }
    
    return list(contracts.values())