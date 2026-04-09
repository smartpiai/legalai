"""RT-04: Recall@10 on a deterministic fixture must be within ±2% of baseline.

Seeds N random-but-deterministic dense vectors into a fresh collection,
computes brute-force top-10 for a deterministic query as ground truth, then
measures Qdrant recall@10 averaged over Q queries. Compared against a
baseline JSON file at ``tests/phase1/qdrant/fixtures/rt04_baseline.json``
(or ``$QDRANT_RT04_BASELINE``). Skips cleanly if no baseline is available.
"""
from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import pytest
from qdrant_client.models import PointStruct, SparseVector

from app.core.vector_store import (
    DENSE_VECTOR_NAME,
    DENSE_VECTOR_SIZE,
    SPARSE_VECTOR_NAME,
    _tenant_filter,
    build_named_vectors_config,
    build_sparse_vectors_config,
)


N_POINTS = 500
N_QUERIES = 20
K = 10
SEED = 1337
TENANT = "rt04"


def _rand_vec(rng: random.Random) -> list[float]:
    v = [rng.gauss(0.0, 1.0) for _ in range(DENSE_VECTOR_SIZE)]
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _baseline_path() -> Path:
    env = os.getenv("QDRANT_RT04_BASELINE")
    if env:
        return Path(env)
    return Path(__file__).parent / "fixtures" / "rt04_baseline.json"


def test_rt04_recall_at_10_within_tolerance(
    qdrant_raw_client, unique_collection_name, cleanup_collection
) -> None:
    baseline_path = _baseline_path()
    if not baseline_path.is_file():
        pytest.skip(f"no RT-04 baseline at {baseline_path}")
    baseline = json.loads(baseline_path.read_text())
    baseline_recall = float(baseline["recall_at_10"])

    collection = cleanup_collection(unique_collection_name)
    qdrant_raw_client.create_collection(
        collection_name=collection,
        vectors_config=build_named_vectors_config(),
        sparse_vectors_config=build_sparse_vectors_config(),
    )

    rng = random.Random(SEED)
    vectors = [_rand_vec(rng) for _ in range(N_POINTS)]
    points = [
        PointStruct(
            id=i + 1,
            vector={
                DENSE_VECTOR_NAME: vectors[i],
                SPARSE_VECTOR_NAME: SparseVector(indices=[0], values=[1.0]),
            },
            payload={"tenant_id": TENANT},
        )
        for i in range(N_POINTS)
    ]
    qdrant_raw_client.upsert(collection_name=collection, points=points, wait=True)

    qrng = random.Random(SEED + 1)
    queries = [_rand_vec(qrng) for _ in range(N_QUERIES)]

    hits_sum = 0
    for q in queries:
        # Brute-force ground truth (cosine == dot since vectors are normalized).
        scored = sorted(
            ((_dot(q, vectors[i]), i + 1) for i in range(N_POINTS)),
            key=lambda t: t[0],
            reverse=True,
        )
        gt = {pid for _, pid in scored[:K]}

        result = qdrant_raw_client.query_points(
            collection_name=collection,
            query=q,
            using=DENSE_VECTOR_NAME,
            query_filter=_tenant_filter(TENANT),
            limit=K,
        )
        got = {h.id for h in result.points}
        hits_sum += len(gt & got)

    recall = hits_sum / (N_QUERIES * K)
    delta = abs(recall - baseline_recall)
    assert delta <= 0.02, (
        f"recall@10 drift: got {recall:.4f} vs baseline {baseline_recall:.4f} "
        f"(delta={delta:.4f} > 0.02)"
    )
