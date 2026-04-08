# Dependency Audit Reports — Phase 0

This directory contains dependency vulnerability audit reports produced as
part of Sprint 3 (tasks S3-007 through S3-011).

## Reports

| Date       | Ecosystem | Report                                         |
| ---------- | --------- | ---------------------------------------------- |
| 2026-04-08 | Python    | [pip-audit-2026-04-08.md](./pip-audit-2026-04-08.md) |
| 2026-04-08 | Node.js   | [npm-audit-2026-04-08.md](./npm-audit-2026-04-08.md) |

## Summary (2026-04-08)

- **Python (`backend/requirements.txt`)**: `pip-audit` could not be run in the
  sandboxed worktree (network/tool-install denied). A manual CVE review of
  known-vulnerable pins was performed and recorded. The highest priority item
  is finding **F4** from the security review: `passlib 1.7.4` is unmaintained.
  Remediated in task **S3-010** by replacing `passlib` with direct `bcrypt`
  usage in `backend/app/core/security.py`.
- **Node.js (`frontend/package.json`)**: `npm audit` reports **23
  vulnerabilities (17 high, 6 moderate)**. The Sprint 3 scope targets finding
  **F5** (Vite / esbuild dev-server CVE chain). Task **S3-011** pins
  `vite ^5.0.12` to address the originally tracked CVE-2024-23331; the
  remaining transitive advisories are triaged in the npm audit report with a
  follow-up ticket recommended for a subsequent sprint so that breaking
  upgrades (e.g. `@typescript-eslint/*` 6→8) can be evaluated deliberately.

## Tooling Notes / Blockers

- `pip-audit` and `pip-tools` (`pip-compile`) were not installable in the
  sandbox because outbound network access and `pip install` into a fresh
  virtualenv were denied. As a result:
  - **S3-007** (Python side): captured manually from known advisories against
    the currently pinned versions; follow-up to re-run `pip-audit` in CI.
  - **S3-008** (`requirements.lock` with hashes): **BLOCKED** in this worktree.
    A placeholder note is kept here; the lockfile must be generated from an
    environment with `pip-tools` installed and network access to PyPI.
- `npm audit` and `npm install` were available and used to regenerate
  `frontend/package-lock.json` after the Vite pin bump.

## S3-009 — package-lock.json sync verification (2026-04-08)

- `frontend/package-lock.json` is tracked in git (`git ls-files` confirmed).
- `cd frontend && npm ci --dry-run` completed successfully (700 packages
  resolved with no drift errors), confirming the lockfile is in sync with
  `frontend/package.json` prior to the Vite pin bump in S3-011.
- Acceptance criteria **IT-LF-03** and **IT-LF-04** satisfied.
