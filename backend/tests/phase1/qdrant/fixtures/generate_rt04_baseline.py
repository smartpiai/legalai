"""Regenerate ``rt04_baseline.json`` for test_rt_recall.py RT-04 (PR FU-3).

At the time of writing (2026-04-08), we do not yet have the Phase 0
recall@10 numbers from the production-like dataset. RT-04 therefore
skips. When the Phase 0 corpus becomes available, run this script from
the repo root with:

    python backend/tests/phase1/qdrant/fixtures/generate_rt04_baseline.py \\
        --corpus /path/to/phase0/corpus.jsonl \\
        --queries /path/to/phase0/queries.jsonl \\
        --out     backend/tests/phase1/qdrant/fixtures/rt04_baseline.json

Expected output shape (consumed by ``test_rt_recall.py::test_rt04``)::

    {
      "generated_at": "2026-04-09T12:00:00Z",
      "collection": "dev__legalai__document_chunks__v2",
      "model":      "text-embedding-3-small",
      "k":          10,
      "metric":     "recall@10",
      "baseline":   0.842,
      "tolerance":  0.02,
      "queries": [
        {
          "query_id": "q001",
          "text":     "...",
          "expected_chunk_ids": ["<doc_uuid>_0", ...]
        }
      ]
    }

This file is a STUB — it documents the expected layout and CLI shape so
that whoever picks up FU-3 does not need to rediscover either. It does
not compute embeddings or run Qdrant; that work is intentionally
deferred until the Phase 0 dataset is committed.

Status: deferred (no Phase 0 data). Tracked in FU-3.
"""
from __future__ import annotations

import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate rt04_baseline.json from a Phase 0 corpus + queries file."
    )
    parser.add_argument("--corpus", required=True, help="Phase 0 corpus JSONL path")
    parser.add_argument("--queries", required=True, help="Phase 0 queries JSONL path")
    parser.add_argument("--out", required=True, help="Output fixture JSON path")
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--model", default="text-embedding-3-small")
    parser.add_argument("--tolerance", type=float, default=0.02)
    args = parser.parse_args()

    print(
        "[FU-3] rt04_baseline generator is a stub — Phase 0 data not yet "
        "available. See docstring for the implementation sketch.",
        file=sys.stderr,
    )
    print(
        f"[FU-3] would read corpus={args.corpus!r} queries={args.queries!r} "
        f"and write {args.out!r} at k={args.k}, tolerance={args.tolerance}.",
        file=sys.stderr,
    )
    return 2  # non-zero so CI does not treat the stub as a successful run


if __name__ == "__main__":
    raise SystemExit(main())
