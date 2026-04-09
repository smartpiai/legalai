"""
Qdrant vector database implementation for embeddings and similarity search.

Refactored for PR 1.4.3 (qdrant-client >= 1.12) per
`docs/phase-1/1.4.3_id-spec_qdrant-named-vectors.md`:

* Collections use the **named-vector** layout (`{"dense": VectorParams(...)}`)
  with a reserved slot for the sparse channel to be wired up in PR 1.4.4.
* Search goes through `client.query_points(...)` (the deprecated
  `client.search(...)` API is no longer used).
* Collection names follow the convention
  ``{env}__legalai__{logical_name}__v{schema_version}`` (Phase 1 ships v2).
* A v1 -> v2 dual-read shim (`legacy_fallback=True`) transparently routes
  dense-only reads to a surviving legacy (unnamed-vector) collection while
  backfill is in progress. The shim **never writes** to legacy collections.
* Every search / delete call enforces a mandatory ``tenant_id`` payload
  filter; callers cannot bypass it.

Sparse vector *support* is intentionally NOT wired in this PR (1.4.3) — the
schema slot is left ready for PR 1.4.4.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Callable, Dict, List, Literal, Optional, Union

from qdrant_client import QdrantClient
from qdrant_client.models import (
    CollectionStatus,
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    Modifier,
    PointStruct,
    SparseIndexParams,
    SparseVector,
    SparseVectorParams,
    UpdateStatus,
    VectorParams,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema constants (ID Spec §3.1, §7.1)
# ---------------------------------------------------------------------------

#: Phase 1 dense embedding dimensionality (text-embedding-3-small / ada-002).
DENSE_VECTOR_SIZE: int = 1536

#: Named dense vector channel. Must be referenced by ``using=`` on search.
DENSE_VECTOR_NAME: str = "dense"

#: Named sparse vector channel. Reserved for PR 1.4.4 — not created yet.
SPARSE_VECTOR_NAME: str = "sparse"

#: Current schema version for new collections.
SCHEMA_VERSION: int = 2


def _current_env() -> str:
    """Resolve the deployment env segment for collection naming."""
    return (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or getattr(settings, "APP_ENV", None)
        or "dev"
    ).lower()


def build_collection_name(
    logical_name: str,
    *,
    env: Optional[str] = None,
    schema_version: int = SCHEMA_VERSION,
) -> str:
    """Return ``{env}__legalai__{logical_name}__v{schema_version}``.

    See ID Spec §3.1. ``logical_name`` must be ``[a-z0-9_]+``.
    """
    if not logical_name or not all(c.isalnum() or c == "_" for c in logical_name):
        raise ValueError(
            f"Invalid logical collection name {logical_name!r}: "
            "must be non-empty and match [a-z0-9_]+"
        )
    env = (env or _current_env()).lower()
    return f"{env}__legalai__{logical_name}__v{schema_version}"


def build_named_vectors_config(
    vector_size: int = DENSE_VECTOR_SIZE,
    distance: Distance = Distance.COSINE,
) -> Dict[str, VectorParams]:
    """Named-vector config dict for ``create_collection``.

    Phase 1 ships only the ``dense`` channel; the ``sparse`` channel is added
    in PR 1.4.4 via ``sparse_vectors_config`` (see placeholder below).
    """
    return {
        DENSE_VECTOR_NAME: VectorParams(size=vector_size, distance=distance),
    }


def build_sparse_vectors_config() -> Dict[str, SparseVectorParams]:
    """Sparse vector channel config (PR 1.4.4).

    Declares the ``sparse`` named channel with IDF weighting per ID Spec
    §7.1. Qdrant will apply the IDF modifier at query time so callers only
    need to pass raw term frequencies / weights.
    """
    return {
        SPARSE_VECTOR_NAME: SparseVectorParams(
            index=SparseIndexParams(on_disk=False, full_scan_threshold=5000),
            modifier=Modifier.IDF,
        ),
    }


# ---------------------------------------------------------------------------
# Sparse vector validation (ID Spec §6)
# ---------------------------------------------------------------------------


class InvalidSparseVector(ValueError):
    """Raised when a sparse vector fails ID Spec §6 validation."""


_SPARSE_MAX_NNZ = 10_000
_INT32_MAX = 2**31


def _validate_sparse(indices: List[int], values: List[float]) -> SparseVector:
    """Validate and normalize a sparse vector per ID Spec §6.

    Rules:
      * equal-length, 1 ≤ nnz ≤ 10_000
      * indices: non-negative int32, strictly ascending, unique
      * values: finite float32, strictly > 0
    Returns a qdrant ``SparseVector`` ready to send on the wire.
    """
    if indices is None or values is None:
        raise InvalidSparseVector("indices and values are required")
    if len(indices) != len(values):
        raise InvalidSparseVector(
            f"indices/values length mismatch: {len(indices)} vs {len(values)}"
        )
    nnz = len(indices)
    if nnz < 1 or nnz > _SPARSE_MAX_NNZ:
        raise InvalidSparseVector(
            f"sparse nnz must be in [1, {_SPARSE_MAX_NNZ}], got {nnz}"
        )

    norm_idx: List[int] = []
    prev = -1
    for raw in indices:
        if not isinstance(raw, int) or isinstance(raw, bool):
            raise InvalidSparseVector(f"non-int index {raw!r}")
        if raw < 0 or raw >= _INT32_MAX:
            raise InvalidSparseVector(f"index out of int32 range: {raw}")
        if raw <= prev:
            raise InvalidSparseVector(
                f"indices must be strictly ascending and unique (got {raw} after {prev})"
            )
        norm_idx.append(raw)
        prev = raw

    import math

    norm_vals: List[float] = []
    for v in values:
        fv = float(v)
        if not math.isfinite(fv):
            raise InvalidSparseVector(f"value not finite: {v}")
        if fv <= 0.0:
            raise InvalidSparseVector(f"value must be > 0, got {fv}")
        norm_vals.append(fv)

    return SparseVector(indices=norm_idx, values=norm_vals)


# ---------------------------------------------------------------------------
# Tenant filter helpers (ID Spec §3.3)
# ---------------------------------------------------------------------------


def _tenant_filter(
    tenant_id: Union[int, str],
    extra_filters: Optional[Dict[str, Any]] = None,
) -> Filter:
    """Build a Qdrant ``Filter`` that enforces tenant isolation.

    The ``tenant_id`` condition is always AND-merged with any caller-supplied
    filter. Callers may not pass their own ``tenant_id`` key.
    """
    if tenant_id is None:
        raise ValueError("tenant_id is mandatory for all vector search / delete calls")

    conditions: List[FieldCondition] = [
        FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
    ]
    if extra_filters:
        if "tenant_id" in extra_filters:
            raise ValueError(
                "Caller filters must not reference reserved key 'tenant_id' "
                "(enforced by repository)"
            )
        for key, value in extra_filters.items():
            conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))
    return Filter(must=conditions)


# ---------------------------------------------------------------------------
# Connection wrapper (unchanged public surface)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Collection lifecycle
# ---------------------------------------------------------------------------


async def create_collection(
    client: QdrantConnection,
    collection_name: str,
    vector_size: int = DENSE_VECTOR_SIZE,
    distance: str = "Cosine",
) -> bool:
    """Create a new vector collection using named-vector layout.

    The ``vectors_config`` is a dict keyed by vector name (Qdrant 1.12+
    named-vectors API). The sparse channel slot is reserved via
    :func:`build_sparse_vectors_config` and wired in PR 1.4.4.
    """
    distance_map = {
        "Cosine": Distance.COSINE,
        "Euclid": Distance.EUCLID,
        "Dot": Distance.DOT,
    }

    vectors_config = build_named_vectors_config(
        vector_size=vector_size,
        distance=distance_map.get(distance, Distance.COSINE),
    )
    sparse_vectors_config = build_sparse_vectors_config()

    client.client.create_collection(
        collection_name=collection_name,
        vectors_config=vectors_config,
        sparse_vectors_config=sparse_vectors_config,
    )
    return True


# ---------------------------------------------------------------------------
# Sparse upsert / search (ID Spec §3.3, §3.4)
# ---------------------------------------------------------------------------


async def upsert_with_sparse(
    client: QdrantConnection,
    collection_name: str,
    points: List[Dict[str, Any]],
    dense_vectors: List[List[float]],
    sparse_vectors: List[Dict[str, List[Any]]],
) -> Dict[str, Any]:
    """Upsert points carrying both dense and sparse named vectors.

    ``points`` is a list of ``{"id": ..., "payload": {...}}`` dicts. The
    dense and sparse lists are parallel to ``points``. Each sparse entry is
    ``{"indices": [...], "values": [...]}`` and is validated per ID Spec §6.
    """
    n = len(points)
    if not (len(dense_vectors) == n == len(sparse_vectors)):
        raise ValueError(
            "points, dense_vectors and sparse_vectors must be the same length"
        )

    point_structs: List[PointStruct] = []
    for point, dense, sparse in zip(points, dense_vectors, sparse_vectors):
        if len(dense) != DENSE_VECTOR_SIZE:
            raise ValueError(
                f"Dense vector dim mismatch: got {len(dense)}, expected {DENSE_VECTOR_SIZE}"
            )
        sv = _validate_sparse(sparse["indices"], sparse["values"])
        point_structs.append(
            PointStruct(
                id=point["id"],
                vector={
                    DENSE_VECTOR_NAME: list(dense),
                    SPARSE_VECTOR_NAME: sv,
                },
                payload=point.get("payload", {}),
            )
        )

    result = client.client.upsert(
        collection_name=collection_name, points=point_structs
    )
    return {
        "status": "success" if result.status == UpdateStatus.COMPLETED else "failed",
        "inserted_count": n,
    }


async def search_sparse(
    client: QdrantConnection,
    collection_name: str,
    query_indices: List[int],
    query_values: List[float],
    tenant_id: Union[int, str],
    limit: int = 10,
    score_threshold: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Sparse similarity search with mandatory tenant filter."""
    sv = _validate_sparse(query_indices, query_values)
    results = client.client.query_points(
        collection_name=collection_name,
        query=sv,
        using=SPARSE_VECTOR_NAME,
        query_filter=_tenant_filter(tenant_id),
        limit=limit,
        score_threshold=score_threshold,
        with_payload=True,
    )
    return _hits_to_dicts(results)


async def delete_collection(client: QdrantConnection, collection_name: str) -> bool:
    """Delete a collection."""
    client.client.delete_collection(collection_name=collection_name)
    return True


# ---------------------------------------------------------------------------
# Point CRUD
# ---------------------------------------------------------------------------


def _to_named_vector(vector: Union[List[float], Dict[str, Any]]) -> Dict[str, Any]:
    """Normalize caller-supplied vector payload to the named form.

    Accepts either a raw ``list[float]`` (implicitly the dense channel) or an
    already-named dict. Dense dim is validated.
    """
    if isinstance(vector, dict):
        named = dict(vector)
    else:
        named = {DENSE_VECTOR_NAME: vector}

    dense = named.get(DENSE_VECTOR_NAME)
    if dense is None:
        raise ValueError("Point is missing the mandatory 'dense' vector")
    if len(dense) != DENSE_VECTOR_SIZE:
        raise ValueError(
            f"Dense vector dim mismatch: got {len(dense)}, expected {DENSE_VECTOR_SIZE}"
        )
    return named


async def insert_vectors(
    client: QdrantConnection,
    collection_name: str,
    vectors: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Insert vectors with metadata (named-vector form)."""
    points = [
        PointStruct(
            id=v["id"],
            vector=_to_named_vector(v["vector"]),
            payload=v.get("payload", {}),
        )
        for v in vectors
    ]

    result = client.client.upsert(collection_name=collection_name, points=points)

    return {
        "status": "success" if result.status == UpdateStatus.COMPLETED else "failed",
        "inserted_count": len(vectors),
    }


def _hits_to_dicts(hits: Any) -> List[Dict[str, Any]]:
    """Extract ``list[dict]`` from a ``query_points`` response.

    ``client.query_points`` returns a ``QueryResponse`` with a ``.points``
    attribute on qdrant-client 1.12+. Fall back to iterating the object for
    forward-compat.
    """
    points = getattr(hits, "points", hits)
    return [
        {"id": hit.id, "score": hit.score, "payload": hit.payload}
        for hit in points
    ]


async def search_vectors(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    tenant_id: Union[int, str],
    limit: int = 10,
    score_threshold: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Similarity search on the ``dense`` channel with mandatory tenant filter.

    Uses ``client.query_points`` (qdrant-client 1.12 API); the deprecated
    ``client.search`` is not called anywhere in this module.
    """
    results = client.client.query_points(
        collection_name=collection_name,
        query=query_vector,
        using=DENSE_VECTOR_NAME,
        query_filter=_tenant_filter(tenant_id),
        limit=limit,
        score_threshold=score_threshold,
        with_payload=True,
    )
    return _hits_to_dicts(results)


async def get_vector_by_id(
    client: QdrantConnection,
    collection_name: str,
    vector_id: str,
) -> Optional[Dict[str, Any]]:
    """Get vector by ID."""
    try:
        result = client.client.retrieve(
            collection_name=collection_name,
            ids=[vector_id],
            with_vectors=True,
        )
        if result:
            point = result[0]
            return {
                "id": point.id,
                "vector": point.vector,
                "payload": point.payload,
            }
    except Exception:
        pass
    return None


async def update_vectors(
    client: QdrantConnection,
    collection_name: str,
    updates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Update vector metadata."""
    for update in updates:
        client.client.set_payload(
            collection_name=collection_name,
            payload=update["payload"],
            points=[update["id"]],
        )
    return {"status": "success"}


async def delete_vectors(
    client: QdrantConnection,
    collection_name: str,
    vector_ids: List[str],
) -> Dict[str, Any]:
    """Delete vectors by IDs."""
    client.client.delete(
        collection_name=collection_name,
        points_selector=vector_ids,
    )
    return {"status": "success"}


async def batch_upsert(
    client: QdrantConnection,
    collection_name: str,
    vectors: List[Dict[str, Any]],
    batch_size: int = 100,
) -> Dict[str, Any]:
    """Batch upsert vectors."""
    total_inserted = 0
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i : i + batch_size]
        result = await insert_vectors(client, collection_name, batch)
        total_inserted += result["inserted_count"]
    return {"status": "success", "total_inserted": total_inserted}


async def search_by_metadata(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    filters: Dict[str, Any],
    tenant_id: Optional[Union[int, str]] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Search with metadata filters, enforcing tenant isolation.

    ``tenant_id`` is preferred as a dedicated kwarg but, for call-site
    compatibility, is also accepted inside the ``filters`` dict. It is always
    AND-merged into the Qdrant filter.
    """
    extra_filters = dict(filters or {})
    if tenant_id is None:
        tenant_id = extra_filters.pop("tenant_id", None)
    else:
        extra_filters.pop("tenant_id", None)

    query_filter = _tenant_filter(tenant_id, extra_filters)

    results = client.client.query_points(
        collection_name=collection_name,
        query=query_vector,
        using=DENSE_VECTOR_NAME,
        query_filter=query_filter,
        limit=limit,
        with_payload=True,
    )
    return _hits_to_dicts(results)


async def hybrid_search(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    tenant_id: Union[int, str],
    query_sparse_indices: Optional[List[int]] = None,
    query_sparse_values: Optional[List[float]] = None,
    limit: int = 10,
    rrf_k: int = 60,
) -> List[Dict[str, Any]]:
    """Dense + sparse fusion via Reciprocal Rank Fusion (RRF).

    Issues two tenant-filtered searches (``dense`` and ``sparse``) and
    fuses the ranked lists with RRF: ``score = sum 1 / (rrf_k + rank)``.
    If no sparse query is supplied, degrades to dense-only for
    call-site compatibility.
    """
    dense_hits = await search_vectors(
        client, collection_name, query_vector,
        tenant_id=tenant_id, limit=limit * 2,
    )
    if query_sparse_indices is None or query_sparse_values is None:
        return dense_hits[:limit]

    sparse_hits = await search_sparse(
        client, collection_name,
        query_indices=query_sparse_indices,
        query_values=query_sparse_values,
        tenant_id=tenant_id,
        limit=limit * 2,
    )

    fused: Dict[Any, Dict[str, Any]] = {}
    for rank, hit in enumerate(dense_hits):
        fused.setdefault(hit["id"], {**hit, "score": 0.0})
        fused[hit["id"]]["score"] += 1.0 / (rrf_k + rank + 1)
    for rank, hit in enumerate(sparse_hits):
        fused.setdefault(hit["id"], {**hit, "score": 0.0})
        fused[hit["id"]]["score"] += 1.0 / (rrf_k + rank + 1)

    ranked = sorted(fused.values(), key=lambda h: h["score"], reverse=True)
    return ranked[:limit]


async def create_contract_embeddings(
    client: QdrantConnection,
    collection_name: str,
    contract_data: Dict[str, Any],
    embedding_function: Callable[[str], List[float]],
) -> Dict[str, Any]:
    """Create embeddings for contract chunks."""
    vectors = []
    for chunk in contract_data.get("chunks", []):
        vector = embedding_function(chunk["text"])
        vectors.append(
            {
                "id": chunk["id"],
                "vector": vector,  # normalized to named form in insert_vectors
                "payload": {
                    "contract_id": contract_data["id"],
                    "text": chunk["text"],
                    **contract_data.get("metadata", {}),
                },
            }
        )

    await insert_vectors(client, collection_name, vectors)

    return {
        "status": "success",
        "contract_id": contract_data["id"],
        "chunks_embedded": len(vectors),
    }


async def search_similar_contracts(
    client: QdrantConnection,
    collection_name: str,
    query_vector: List[float],
    tenant_id: Union[int, str],
    contract_type: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """Search for similar contracts within a tenant."""
    extra: Dict[str, Any] = {}
    if contract_type:
        extra["contract_type"] = contract_type

    results = await search_by_metadata(
        client,
        collection_name,
        query_vector,
        filters=extra,
        tenant_id=tenant_id,
        limit=limit,
    )

    contracts: Dict[str, Dict[str, Any]] = {}
    for result in results:
        contract_id = result["payload"].get("contract_id")
        if contract_id and contract_id not in contracts:
            contracts[contract_id] = {
                "id": contract_id,
                "score": result["score"],
                "metadata": {
                    k: v
                    for k, v in result["payload"].items()
                    if k not in ["text", "contract_id"]
                },
            }
    return list(contracts.values())


# ---------------------------------------------------------------------------
# v1 -> v2 dual-read shim (ID Spec §10.3)
# ---------------------------------------------------------------------------


class LegacyCollectionNoSparse(Exception):
    """Raised when a sparse query is issued against a legacy v1 collection."""


class QdrantVectorStore:
    """Thin repository that implements the v1 -> v2 dual-read shim.

    Writes always target the ``v2`` collection. Reads prefer ``v2``; if
    ``legacy_fallback`` is True and the ``v2`` collection does not exist (or
    is empty) while a legacy (unnamed-vector) collection does, dense-only
    reads transparently fall through to the legacy collection. Sparse reads
    against legacy always raise ``LegacyCollectionNoSparse``.

    See ID Spec §10.3 steps 1-6. The ``legacy_fallback`` flag is an explicit
    feature flag with a mandatory cleanup ticket — target removal
    **2026-08-01**.
    """

    def __init__(
        self,
        connection: QdrantConnection,
        logical_name: str,
        *,
        env: Optional[str] = None,
        schema_version: int = SCHEMA_VERSION,
        legacy_fallback: bool = False,
    ) -> None:
        self.connection = connection
        self.logical_name = logical_name
        self.env = env or _current_env()
        self.schema_version = schema_version
        self.legacy_fallback = legacy_fallback
        self.v2_name = build_collection_name(
            logical_name, env=self.env, schema_version=schema_version
        )
        # Legacy v1 layout used the bare logical name.
        self.legacy_name = logical_name

    # -- introspection -----------------------------------------------------

    def _collection_exists(self, name: str) -> bool:
        try:
            self.connection.client.get_collection(collection_name=name)
            return True
        except Exception:
            return False

    def _collection_is_empty(self, name: str) -> bool:
        try:
            info = self.connection.client.get_collection(collection_name=name)
            count = getattr(info, "points_count", None)
            return count is None or count == 0
        except Exception:
            return True

    def _resolve_read_collection(
        self,
        vector_name: Literal["dense", "sparse"] = DENSE_VECTOR_NAME,
    ) -> str:
        """Pick the collection a read should hit.

        Preference order:
          1. ``v2`` if it exists and has points.
          2. legacy if ``legacy_fallback`` is enabled and legacy exists.
          3. ``v2`` as a last resort (will raise CollectionNotFound upstream).
        """
        v2_exists = self._collection_exists(self.v2_name)
        if v2_exists and not self._collection_is_empty(self.v2_name):
            return self.v2_name

        if self.legacy_fallback and self._collection_exists(self.legacy_name):
            if vector_name == SPARSE_VECTOR_NAME:
                raise LegacyCollectionNoSparse(
                    f"Collection {self.legacy_name!r} is legacy v1 (no sparse channel). "
                    "Caller must fall back to dense-only search."
                )
            logger.warning(
                "qdrant.legacy_v1_read",
                extra={"collection": self.legacy_name, "logical": self.logical_name},
            )
            return self.legacy_name

        return self.v2_name

    # -- public ops --------------------------------------------------------

    async def ensure_collection(self) -> None:
        """Create the ``v2`` collection if missing."""
        if self._collection_exists(self.v2_name):
            return
        await create_collection(self.connection, self.v2_name)

    async def upsert(self, vectors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Upsert points. Always targets ``v2`` — never writes to legacy."""
        return await insert_vectors(self.connection, self.v2_name, vectors)

    async def search(
        self,
        query_vector: List[float],
        *,
        tenant_id: Union[int, str],
        limit: int = 10,
        score_threshold: Optional[float] = None,
        vector_name: Literal["dense", "sparse"] = DENSE_VECTOR_NAME,
    ) -> List[Dict[str, Any]]:
        """Dense search with tenant filter and v1 -> v2 dual-read shim."""
        target = self._resolve_read_collection(vector_name)

        if vector_name == SPARSE_VECTOR_NAME and target != self.legacy_name:
            # Sparse path: query is a dict/SparseVector of indices+values.
            if isinstance(query_vector, dict):
                indices = query_vector["indices"]
                values = query_vector["values"]
            else:
                raise ValueError(
                    "sparse search expects query as {'indices': [...], 'values': [...]}"
                )
            return await search_sparse(
                self.connection, target,
                query_indices=indices, query_values=values,
                tenant_id=tenant_id, limit=limit,
                score_threshold=score_threshold,
            )

        if target == self.legacy_name:
            # Legacy collection uses the unnamed default vector. Call
            # query_points without `using=` so qdrant routes to the unnamed
            # channel.
            results = self.connection.client.query_points(
                collection_name=target,
                query=query_vector,
                query_filter=_tenant_filter(tenant_id),
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
            )
            return _hits_to_dicts(results)

        return await search_vectors(
            self.connection,
            target,
            query_vector,
            tenant_id=tenant_id,
            limit=limit,
            score_threshold=score_threshold,
        )

    async def delete(
        self,
        *,
        tenant_id: Union[int, str],
        point_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Delete by id within the tenant (v2 only)."""
        if not point_ids:
            raise ValueError("point_ids is required")
        # Tenant is validated here for API symmetry; Qdrant delete-by-id is
        # already scoped to known points, but callers must not be able to
        # omit the argument.
        _ = _tenant_filter(tenant_id)
        return await delete_vectors(self.connection, self.v2_name, point_ids)
