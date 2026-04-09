"""IT-QD-02: qdrant-client connects and lists collections."""
from __future__ import annotations

import qdrant_client


def test_qdrant_client_version_ge_1_12() -> None:
    ver = tuple(int(x) for x in qdrant_client.__version__.split(".")[:2])
    assert ver >= (1, 12), f"qdrant-client {qdrant_client.__version__} < 1.12"


def test_client_lists_collections(qdrant_raw_client) -> None:
    result = qdrant_raw_client.get_collections()
    # .collections is a list (possibly empty) — call must succeed.
    assert hasattr(result, "collections")
    assert isinstance(result.collections, list)
