---
description: Plan all required documents for a phase based on the Document Matrix
---

I need to plan the documentation for Phase $1.

Read `DOCUMENT_MATRIX.md` and find all document requirements for Phase $1. Then:

1. List every required document with its type, sub-number, and responsible role
2. Identify which documents already exist by scanning `docs/phase-$1/`
3. Determine the creation order based on the document dependency chain (BRD first, then PRD, then ADR/Tech Spec, then downstream)
4. For each missing document, note who should write it and what upstream dependencies it needs
5. Check gate readiness using the `doc_gate_check` tool

Output a prioritized action plan showing what to write next and in what order.
