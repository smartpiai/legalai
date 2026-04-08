/**
 * doc-gates — Document dependency gate enforcement.
 *
 * Intercepts file write operations to docs/ directories and warns when
 * upstream document dependencies are missing. Does NOT block writes —
 * it adds a warning to the agent's context so the human can decide.
 *
 * Also provides:
 *   - `context` hook: when working in a docs/ path, remind the agent of
 *     the relevant template and naming convention
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { existsSync, readdirSync } from "fs"
import { join, dirname, basename } from "path"

// ── Upstream dependency map ────────────────────────────────────────

const UPSTREAM: Record<string, { deps: string[]; label: string }> = {
	prd: { deps: ["brd"], label: "PRD" },
	adr: { deps: ["brd"], label: "ADR" },
	"tech-spec": { deps: ["prd"], label: "Tech Spec" },
	"id-spec": { deps: ["tech-spec"], label: "ID Spec" },
	"test-spec": { deps: ["tech-spec"], label: "Test Spec" },
	"perf-spec": { deps: ["tech-spec"], label: "Perf Spec" },
	"sec-review": { deps: ["tech-spec"], label: "Sec Review" },
	"mig-guide": { deps: ["tech-spec"], label: "Migration Guide" },
	runbook: { deps: ["tech-spec", "mig-guide"], label: "Runbook" },
	"dep-review": { deps: [], label: "Dep Review" },
	brd: { deps: [], label: "BRD" },
}

// Key sections expected per doc type (derived from templates in docs/templates/).
// These are unique section headings that identify structural compliance.
// We check for substring matches, so "## 1. Executive Summary" matches "Executive Summary".
const TEMPLATE_SECTIONS: Record<string, string[]> = {
	brd: [
		"Executive Summary",
		"Business Problem",
		"Impact of Inaction",
		"Proposed Solution",
		"Key Assumptions",
		"Alternatives Considered",
		"Cost Estimate",
		"Expected Return",
		"Success Metrics",
		"Stakeholder Impact",
		"Dependencies & Risks",
		"Timeline",
		"Approval",
	],
	prd: [
		"Problem Statement",
		"User Stories",
		"Requirements",
		"User Experience",
		"Success Metrics",
		"Out of Scope",
		"Open Questions",
	],
	adr: ["Context", "Assumptions", "Decision Drivers", "Options Considered", "Decision", "Consequences"],
	"tech-spec": [
		"Overview",
		"Background",
		"Design",
		"Rejected Approaches",
		"Error Handling",
		"Security Considerations",
		"Observability",
		"Rollout Plan",
	],
	"test-spec": [
		"Scope",
		"How to Run",
		"Coverage Targets",
		"Test Cases",
		"Test Data",
		"Pass / Fail Criteria",
	],
	"id-spec": [
		"Overview",
		"Global API Policies",
		"API Endpoints",
		"Pagination",
		"Versioning",
	],
	"mig-guide": [
		"Overview",
		"Pre-Migration Checklist",
		"Migration Steps",
		"Dry Run Results",
		"Rollback Procedure",
		"Post-Migration Verification",
	],
	runbook: [
		"Quick Reference Card",
		"Service Overview",
		"Monitoring",
		"Known Limits",
		"Common Issues",
		"Escalation Path",
		"Backup & Recovery",
	],
	"sec-review": [
		"Change Summary",
		"Threat Model",
		"Authentication & Authorization",
		"Data Handling",
		"Compliance Mapping",
		"Findings & Recommendations",
		"Approval",
	],
	"dep-review": [
		"Motivation",
		"Dependencies Under Review",
		"License Audit",
		"Security Audit",
		"Breaking Changes",
		"Transitive Dependencies",
		"Maintenance Plan",
		"Rollback Plan",
		"Decision",
	],
	"perf-spec": [
		"Load Profile",
		"Performance Budgets",
		"Baselines",
		"Benchmark Design",
		"Regression Thresholds",
		"Monitoring in Production",
		"Graceful Degradation",
	],
}

const NAMING_CONVENTION = `docs/{phase}/{phase-sub-number}_{doc-type}_{short-name}.md
Example: docs/phase-1/1.2.1_tech-spec_pgvector-schema.md`

// ── Helpers ────────────────────────────────────────────────────────

function parseDocPath(filePath: string): { phase: string; type: string; subNumber: string } | null {
	// Match: docs/phase-{N}/{sub}_{type}_{name}.md or similar
	const match = filePath.match(/docs\/phase-(\d+)\/([\d.]+)_([a-z-]+)_/)
	if (!match) return null
	return { phase: match[1], subNumber: match[2], type: match[3] }
}

function getExistingDocTypes(cwd: string, phase: string): string[] {
	const phaseDir = join(cwd, "docs", `phase-${phase}`)
	if (!existsSync(phaseDir)) return []

	const types: string[] = []
	try {
		for (const file of readdirSync(phaseDir)) {
			const match = file.match(/^[\d.]+_([a-z-]+)_/)
			if (match) types.push(match[1])
		}
	} catch {
		// directory not readable
	}
	return types
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Hook: warn on missing upstream deps when writing docs ──────

	pi.on("tool_call", async (event: any, ctx: any) => {
		// Only intercept write and edit operations targeting docs/
		const toolName = event.toolName ?? event.name
		if (toolName !== "write" && toolName !== "edit") return

		const filePath: string = event.input?.file_path ?? event.input?.path ?? ""
		if (!filePath.includes("/docs/phase-")) return

		const parsed = parseDocPath(filePath)
		if (!parsed) {
			// File is in docs/ but doesn't follow naming convention
			return {
				prependToResult: `\n⚠ WARNING: This file path does not follow the naming convention.\nExpected: ${NAMING_CONVENTION}\n\n`,
			}
		}

		const upstream = UPSTREAM[parsed.type]
		if (!upstream || upstream.deps.length === 0) return

		const cwd = ctx.cwd ?? process.cwd()
		const existingTypes = getExistingDocTypes(cwd, parsed.phase)
		const missingDeps = upstream.deps.filter((dep) => !existingTypes.includes(dep))

		if (missingDeps.length === 0) return

		const missingLabels = missingDeps
			.map((dep) => UPSTREAM[dep]?.label ?? dep)
			.join(", ")

		return {
			prependToResult:
				`\n⚠ UPSTREAM DEPENDENCY WARNING: Creating a ${upstream.label} for Phase ${parsed.phase}, ` +
				`but the following upstream documents are missing: ${missingLabels}.\n` +
				`The document dependency chain expects these to exist first.\n` +
				`This is a warning — the write will proceed — but consider creating the upstream documents.\n\n`,
		}
	})

	// ── Hook: add doc context when agent is working in docs/ ──────

	pi.on("context", async (event: any, ctx: any) => {
		// Check if recent messages reference docs/ paths
		const messages = event.messages ?? []
		const recentText = messages
			.slice(-5)
			.map((m: any) => JSON.stringify(m.content ?? ""))
			.join(" ")

		if (!recentText.includes("docs/phase-") && !recentText.includes("docs/templates/")) return

		return {
			additionalContext: [
				"## Document Authoring Context — TEMPLATE COMPLIANCE REQUIRED",
				"",
				`**Naming convention**: ${NAMING_CONVENTION}`,
				"",
				"**MANDATORY**: Before writing ANY document, read the template from `docs/templates/`.",
				"Every document must structurally match its template:",
				"- Same section numbers and headings, same order",
				"- Same table structures with same columns",
				"- Same header blockquote fields",
				"- Unused sections marked `N/A — {reason}`, never deleted",
				"- Related Documents table with relative links to upstream/downstream docs",
				"- Version History table with at least initial draft entry",
				"- Status field set in header blockquote",
				"",
				"Template mapping:",
				"  brd → BRD_TEMPLATE.md           prd → PRD_TEMPLATE.md",
				"  adr → ADR_TEMPLATE.md           tech-spec → TECH_SPEC_TEMPLATE.md",
				"  test-spec → TEST_SPEC_TEMPLATE.md  id-spec → ID_SPEC_TEMPLATE.md",
				"  mig-guide → MIG_GUIDE_TEMPLATE.md  runbook → RUNBOOK_TEMPLATE.md",
				"  sec-review → SEC_REVIEW_TEMPLATE.md  dep-review → DEP_REVIEW_TEMPLATE.md",
				"  perf-spec → PERF_SPEC_TEMPLATE.md",
				"",
				"Consult `DOCUMENT_MATRIX.md` for which documents are required for each PR.",
			].join("\n"),
		}
	})

	// ── Hook: validate template structure on writes ────────────────

	pi.on("tool_result", async (event: any, _ctx: any) => {
		const toolName = event.toolName ?? event.name
		if (toolName !== "write" && toolName !== "edit") return

		const filePath: string = event.input?.file_path ?? event.input?.path ?? ""
		if (!filePath.includes("/docs/phase-")) return

		const content: string = event.input?.content ?? event.input?.new_string ?? ""
		// Only validate substantial writes (full documents), not small edits
		if (content.length < 500) return

		const parsed = parseDocPath(filePath)
		const warnings: string[] = []

		// ── Required structural elements (all doc types) ──

		if (!content.includes("## Version History") && !content.includes("Version History")) {
			warnings.push("MISSING: Version History table (required in every template)")
		}

		if (content.startsWith("# ") || content.startsWith("> **")) {
			if (!content.includes("Related Documents")) {
				warnings.push("MISSING: Related Documents table (required in every template)")
			}
			if (!content.includes("**Status**:") && !content.includes("> **Status**")) {
				warnings.push("MISSING: Status field in header blockquote")
			}
		}

		// ── Template-specific section checks ──

		if (parsed) {
			const expectedSections = TEMPLATE_SECTIONS[parsed.type]
			if (expectedSections) {
				const missingSections: string[] = []
				for (const section of expectedSections) {
					// Check for the section heading (with or without number prefix)
					if (!content.includes(section)) {
						missingSections.push(section)
					}
				}
				if (missingSections.length > 0) {
					warnings.push(
						`TEMPLATE MISMATCH: The following sections from ${
							UPSTREAM[parsed.type]?.label ?? parsed.type
						} template are missing:\n` +
							missingSections.map((s) => `    - ${s}`).join("\n") +
							`\n    Read docs/templates/ to see the required structure.`
					)
				}
			}
		}

		if (warnings.length > 0) {
			return {
				appendToResult:
					"\n\n⚠ TEMPLATE COMPLIANCE CHECK:\n" +
					warnings.map((w) => `  ${w}`).join("\n\n") +
					"\n\nDocuments must match their template structure. Read the template and fix before marking complete.",
			}
		}
	})
}
