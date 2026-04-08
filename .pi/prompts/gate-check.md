---
description: Check all approval gates for a phase and report readiness
---

Check the approval gate readiness for Phase $1.

Use the `doc_gate_check` tool with phase="$1" to check all gates. Then:

1. Report which gates are PASS vs BLOCKED
2. For each blocked gate, list the specific missing documents
3. Identify who is responsible for creating each missing document (reference `docs/ORG_DOC_FLOW.md`)
4. Suggest the most efficient path to unblock — which document should be written first?

If all gates pass, confirm readiness and note any conditional documents that may still be needed (e.g., Sec Review for security-sensitive PRs, Mig Guide for schema changes).
