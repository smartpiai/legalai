# Dependency Review

> **Title**: {dependency or set of dependencies being reviewed}
> **Phase**: {phase} | **PR(s)**: {PR numbers}
> **Author**: {name}
> **Date**: {YYYY-MM-DD}
> **Status**: Approved | Blocked | Conditional

---

## 1. Motivation

{Why is this dependency being added or upgraded? What problem does it solve, what CVE does it fix, or what capability does it unlock?}

**Triggering event**: {e.g., "CVE-2024-XXXX disclosed", "New feature requires X capability", "Upstream EOL announced"}
**Tracking issue**: [{PROJ-NNN}]({issue tracker URL})

## 2. Dependencies Under Review

| Package | Current Version | Target Version | Ecosystem |
|---------|----------------|----------------|-----------|
| {package} | {current or N/A if new} | {target} | {PyPI / npm} |

### Version Pinning Strategy

| File | Strategy | Verified |
|------|----------|----------|
| `requirements.txt` / `pyproject.toml` | {Exact pin `==X.Y.Z` / Minor range `~=X.Y` / Compatible `^X.Y`} | {Yes/No} |
| `package.json` | {Exact / Caret `^` / Tilde `~`} | {Yes/No} |
| Lockfile (`poetry.lock` / `package-lock.json`) | {Committed and up to date?} | {Yes/No} |
| Docker base images | {Pinned to digest / tag / latest} | {Yes/No} |

## 3. License Audit

| Package | License | Compatible with Project? | Notes |
|---------|---------|------------------------|-------|
| {package} | {MIT/Apache/BSD/SSPL/...} | {Yes/No/Review needed} | {e.g., "SSPL is not OSI-approved"} |

## 4. Security Audit

| Package | Known CVEs | Last Security Release | Maintainer Activity |
|---------|-----------|----------------------|---------------------|
| {package} | {CVE IDs or "None"} | {date} | {Active/Stale/Archived} |

### Supply Chain Health

| Indicator | Value | Risk Level |
|-----------|-------|------------|
| Number of maintainers | {e.g., 3} | {Low if > 2, Medium if 1-2, High if 1} |
| Bus factor | {e.g., 2} | {Low/Medium/High} |
| Funding model | {Corporate / Foundation / Community / Unfunded} | {Low/Medium/High} |
| Last ownership transfer | {date or "Never"} | {Flag if recent or frequent} |
| OpenSSF Scorecard | {score or "N/A"} | {link to scorecard} |
| Typosquat check | {Verified safe / Flagged} | {Low/High} |
| Package signing / provenance | {Signed / Unsigned / N/A} | {Low/Medium} |

### Audit Tools Checklist

- [ ] `pip-audit` / `npm audit` — [{link to report or "clean"}]
- [ ] GitHub Advisory Database — [{link or "no advisories"}]
- [ ] Socket.dev / Snyk — [{link to report or "clean"}]
- [ ] License scanner (FOSSA / licensee) — [{link to report or "all compatible"}]
- [ ] OpenSSF Scorecard — [{link to scorecard}]

## 5. Breaking Changes

| Package | Breaking Change | Impact on Our Code | Fix Required | Tracked In |
|---------|----------------|-------------------|-------------|------------|
| {package} | {e.g., "Removed deprecated `from_orm()` method"} | {e.g., "3 files use this pattern"} | {e.g., "Replace with `model_validate()`"} | [{PROJ-NNN}]({URL}) |

## 6. Transitive Dependencies

| New Transitive Dep | Pulled In By | License | Size |
|--------------------|-------------|---------|------|
| {dep} | {parent package} | {license} | {size} |

**Total bundle impact**: {+X MB backend / +X KB frontend bundle}

### Runtime Impact

| New Transitive Dep | Cold Start Impact | Memory Overhead | Notes |
|--------------------|-------------------|-----------------|-------|
| {dep} | {e.g., +200ms} | {e.g., +15MB RSS} | {e.g., Loads native extension at import time} |

## 7. Maintenance Plan

| Aspect | Detail |
|--------|--------|
| Update strategy | {e.g., Dependabot / Renovate / Manual quarterly review} |
| Update owner | {e.g., Platform team / Feature team / Rotating on-call} |
| Breaking change policy | {e.g., Pin to minor range, review major bumps manually} |
| Deprecation monitoring | {e.g., Subscribe to GitHub releases / Watch changelog RSS} |
| Fallback if abandoned | {e.g., Fork and maintain / Switch to {alternative package}} |

## 8. Alternatives Considered

> Only if this is a new dependency. Skip for version bumps — mark as `N/A — version bump only`.

| Alternative | Why Not Chosen |
|-------------|---------------|
| {alt package} | {reason} |

## 9. Rollback Plan

{If the upgrade causes issues, how do we revert?}

```bash
# Revert to previous version
pip install {package}=={old_version}
# or
git revert {commit}
```

**Tracking issue for rollback verification**: [{PROJ-NNN}]({URL}) or N/A

## 10. Decision

- [ ] **Approved** — safe to merge
- [ ] **Approved with conditions** — {conditions}
- [ ] **Blocked** — {reason, required action, tracked in [{PROJ-NNN}]({URL})}

## 11. Related Documents

| Document | Link |
|----------|------|
| ADR | [ADR](../phase-{X}/{X.X}_adr_{name}.md) |
| Tech Spec | [Tech Spec](../phase-{X}/{X.X}_tech-spec_{name}.md) |
| Security Review | [Security Review](../phase-{X}/{X.X}_sec-review_{name}.md) |
| Originating Issue | [{PROJ-NNN}]({URL}) |
| {Other} | [{Title}]({relative path}) |

## Version History

| Date | Change | Author |
|------|--------|--------|
| {YYYY-MM-DD} | Initial review | {name} |
| {YYYY-MM-DD} | {e.g., Updated after CVE disclosure} | {name} |
| {YYYY-MM-DD} | {e.g., Approved} | {name} |
