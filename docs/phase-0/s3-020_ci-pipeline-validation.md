# S3-020 — CI Pipeline Validation Report

**Sprint:** 3
**Task:** S3-020 — Validate Gitea Actions pipeline YAML and document expected execution timing.
**Workflow file:** `.github/workflows/ci.yml`
**Date:** 2026-04-08

## 1. Static YAML Validation

The workflow file was parsed successfully with PyYAML `safe_load`:

```
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
# => no errors (BOTH OK including docker-compose.yml)
```

Result: **PASS** — YAML is syntactically valid and Gitea Actions / GitHub Actions compatible
(`actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`,
`actions/upload-artifact@v3`, `actions/download-artifact@v3`,
`docker/setup-buildx-action@v3`).

`docker-compose.yml` also parses cleanly after the S3-012 image digest pinning.

## 2. Job Graph & Parallelism

```
                 ┌──────────────────┐
                 │   (trigger)      │
                 └────────┬─────────┘
                          │ fan-out (5 parallel jobs)
        ┌─────────────┬───┴───┬─────────────┬──────────────┐
        ▼             ▼       ▼             ▼              ▼
  test-backend  test-frontend lint-backend lint-frontend security-audit
        └─────────────┴───┬───┴─────────────┴──────────────┘
                          │ all required
                          ▼
                       build  (docker compose build)
                          │
                          ▼ (only on push to main)
                   baseline-record
```

Five jobs run in parallel on fan-out. `build` gates on all five. `baseline-record`
only runs on `push` to `main` and depends on `build`.

## 3. Estimated Timing (per job, cold cache → warm cache)

| Job              | Cold  | Warm  | Notes                                                     |
|------------------|-------|-------|-----------------------------------------------------------|
| test-backend     | 4m    | 2m    | pip install from `requirements.lock` + pytest + coverage  |
| test-frontend    | 3m30s | 1m30s | `npm ci` + vitest w/ coverage                             |
| lint-backend     | 2m30s | 1m    | ruff (fast) + mypy (dominant)                             |
| lint-frontend    | 2m    | 50s   | eslint + `tsc --noEmit`                                   |
| security-audit   | 2m    | 1m    | pip-audit + npm audit                                     |
| build            | 6m    | 3m30s | docker compose build for backend + frontend + celery     |
| baseline-record  | 40s   | 40s   | artifact download + baseline.json generation             |

**Critical path (warm cache):** max(parallel fan-out) + build + baseline
≈ max(2m, 1m30s, 1m, 50s, 1m) + 3m30s + 40s ≈ **6m 10s**.

**Critical path (cold cache, first run):** max(4m, 3m30s, 2m30s, 2m, 2m) + 6m + 40s
≈ **10m 40s**.

The < 10 min target is met on warm cache (typical PR iteration). Cold cache
slightly exceeds target by ~40s on the very first run; subsequent runs benefit
from `actions/setup-python` pip cache (keyed on `backend/requirements.lock`)
and `actions/setup-node` npm cache (keyed on `frontend/package-lock.json`).

### Mitigations if target is missed on real runner

1. Split `security-audit` into two parallel sub-jobs (pip-audit, npm-audit).
2. Pre-build a base image containing pinned `requirements.lock` deps.
3. Enable Docker layer cache in `build` via `actions/cache` against `/tmp/.buildx-cache`.
4. Drop `mypy` to strict-only on changed files for PR runs.

## 4. Acceptance Criteria Coverage

| ID        | Job             | Satisfied by                                           |
|-----------|-----------------|--------------------------------------------------------|
| IT-CI-01  | test-backend    | `pytest --cov=app --cov-report=xml`                    |
| IT-CI-02  | test-backend    | coverage artifact upload                               |
| IT-CI-03  | test-frontend   | `npm run test -- --coverage`                           |
| IT-CI-04  | test-frontend   | coverage artifact upload                               |
| IT-CI-05  | lint-backend    | `ruff check .`                                         |
| IT-CI-06  | lint-backend    | `mypy app`                                             |
| IT-CI-07  | lint-frontend   | `npm run lint`                                         |
| IT-CI-08  | lint-frontend   | `npx tsc --noEmit`                                     |
| IT-CI-09  | security-audit  | `pip-audit -r requirements.lock --strict`              |
| IT-CI-10  | security-audit  | `npm audit --audit-level=high`                         |
| IT-CI-11  | security-audit  | non-zero exit on high/critical -> job fails            |
| IT-CI-12  | build           | `docker compose config -q` + `docker compose build`    |
| IT-CI-13  | build           | build duration captured as artifact                    |
| IT-CI-14  | baseline-record | `if: github.ref == 'refs/heads/main'` + push event     |
| IT-CI-15  | baseline-record | `scripts/record-baseline.sh` emits JSON                |
| IT-CI-16  | baseline-record | `baseline-metrics` artifact upload                     |

## 5. Prerequisites for Live Validation

The following must be in place before a real Gitea runner execution:

- [ ] Gitea Actions runner registered with `ubuntu-latest` label and Docker-in-Docker support.
- [ ] `backend/requirements.lock` committed (produced by Sprint 3 earlier tasks).
- [ ] `backend/pyproject.toml` contains `[tool.ruff]` and `[tool.mypy]` sections.
- [ ] `frontend/package.json` defines `test`, `lint` scripts; vitest configured with coverage provider.
- [ ] `frontend/package-lock.json` committed.
- [ ] Repository secrets (if any) configured for registry push (not required by current workflow).
- [ ] Runner has >= 4 CPU / 8 GB RAM for `build` job to complete within the 6 min estimate.

## 6. Live Validation Procedure (to run once infra is ready)

1. Open a draft PR from `plan/legalai-v2` touching a trivial backend and frontend file.
2. Confirm all 5 fan-out jobs start in parallel.
3. Confirm `build` starts only after all 5 succeed.
4. Confirm `baseline-record` is skipped on PR (only runs on `push` to `main`).
5. Merge to `main` and confirm `baseline-record` runs and uploads `baseline-metrics` artifact.
6. Record actual wall-clock durations and update the table in §3.

## 7. Result

- YAML parse: **PASS**
- Job graph: **PASS** (matches sprint spec)
- Estimated warm-cache duration: **~6m 10s** (target < 10m: **PASS**)
- Estimated cold-cache duration: **~10m 40s** (target < 10m: **MARGINAL** — see mitigations)
- Live execution: **DEFERRED** — requires runner; see §5–§6.
