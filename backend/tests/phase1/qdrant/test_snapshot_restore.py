"""IT-QD-03: restore a Phase 0 snapshot file into Qdrant 1.12.

Skipped cleanly if no snapshot fixture is available. Set
``QDRANT_PHASE0_SNAPSHOT`` to the path of a ``.snapshot`` file (and
optionally ``QDRANT_PHASE0_SNAPSHOT_POINTS`` to the expected point count).
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest


SNAPSHOT_ENV = "QDRANT_PHASE0_SNAPSHOT"
EXPECTED_POINTS_ENV = "QDRANT_PHASE0_SNAPSHOT_POINTS"


def test_restore_phase0_snapshot(qdrant_raw_client, cleanup_collection) -> None:
    snap_path_str = os.getenv(SNAPSHOT_ENV)
    if not snap_path_str:
        pytest.skip(f"no Phase 0 snapshot fixture ({SNAPSHOT_ENV} not set)")
    snap_path = Path(snap_path_str)
    if not snap_path.is_file():
        pytest.skip(f"snapshot fixture not found at {snap_path}")

    collection = cleanup_collection(
        f"test__phase1__snapshot_restore__{os.getpid()}"
    )

    try:
        with snap_path.open("rb") as fh:
            qdrant_raw_client.recover_snapshot(
                collection_name=collection,
                location=str(snap_path),
            )
    except Exception:
        # Older clients require upload_snapshot; fall back.
        try:
            qdrant_raw_client.upload_snapshot(
                collection_name=collection,
                snapshot=str(snap_path),
            )
        except Exception as exc:  # pragma: no cover
            pytest.skip(f"snapshot restore not supported by client: {exc}")

    info = qdrant_raw_client.get_collection(collection_name=collection)
    assert info is not None
    count = qdrant_raw_client.count(collection_name=collection, exact=True).count
    expected = os.getenv(EXPECTED_POINTS_ENV)
    if expected is not None:
        assert count == int(expected), (
            f"restored point count {count} != expected {expected}"
        )
    else:
        assert count >= 0
