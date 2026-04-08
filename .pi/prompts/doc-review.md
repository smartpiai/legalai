---
description: Review a document for completeness and quality against its template
---

Review the document at `$1` for completeness and quality.

Follow this process:

1. Read the document at `$1`
2. Determine its type from the filename (e.g., `_tech-spec_` means Tech Spec)
3. Read the corresponding template from `docs/templates/`
4. Compare section-by-section: what's present, what's missing, what's incomplete
5. Run `doc_validate` on the document to check cross-references and upstream dependencies
6. Apply the role-specific quality criteria from the review-doc skill

Generate a structured review report with:
- Overall grade (A through F)
- Structural completeness score
- Critical issues (must fix before approval)
- Important issues (should fix)
- Minor issues (nice to have)
- Strengths (what the document does well)
- Specific recommended actions
