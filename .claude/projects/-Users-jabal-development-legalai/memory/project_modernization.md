---
name: Modernization Roadmap Active
description: Legal AI Platform modernization effort kicked off 2026-03-31 — 5 phases, 124 PRs, targeting 10-12 weeks. Roadmap lives in MODERNIZATION_ROADMAP.md at project root.
type: project
---

Modernization roadmap created 2026-03-31 after 7 months of project dormancy. **Why:** All dependencies are significantly outdated (LangChain 0.1, OpenAI 1.6, torch 2.1, React 18, Vite 5). API layer exists but router uses try/except guards. No pyproject.toml. **How to apply:** Reference MODERNIZATION_ROADMAP.md for PR breakdown. Phase 0 (stabilization) must go first. Phases 1-4 can partially overlap. Phase 5 depends on Phase 3. User wants small, reviewable PRs (≤400 lines).
