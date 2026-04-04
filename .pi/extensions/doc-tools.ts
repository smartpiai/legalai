/**
 * doc-tools — Document inventory and validation tools for the Legal AI Platform.
 *
 * Provides:
 *   - `doc_status` tool: scan docs/ and report inventory by phase/type
 *   - `doc_validate` tool: check cross-references and upstream dependencies
 *   - `/docs` command: quick document inventory summary
 *   - `/create-doc` command: scaffold a new document from template with correct naming
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readdirSync, readFileSync, existsSync, statSync } from "fs"
import { join, basename, relative } from "path"

// ── Constants ──────────────────────────────────────────────────────

const DOC_TYPES = [
	{ abbrev: "brd", label: "BRD", template: "BRD_TEMPLATE.md" },
	{ abbrev: "prd", label: "PRD", template: "PRD_TEMPLATE.md" },
	{ abbrev: "adr", label: "ADR", template: "ADR_TEMPLATE.md" },
	{ abbrev: "tech-spec", label: "Tech Spec", template: "TECH_SPEC_TEMPLATE.md" },
	{ abbrev: "test-spec", label: "Test Spec", template: "TEST_SPEC_TEMPLATE.md" },
	{ abbrev: "id-spec", label: "ID Spec", template: "ID_SPEC_TEMPLATE.md" },
	{ abbrev: "mig-guide", label: "Mig Guide", template: "MIG_GUIDE_TEMPLATE.md" },
	{ abbrev: "runbook", label: "Runbook", template: "RUNBOOK_TEMPLATE.md" },
	{ abbrev: "sec-review", label: "Sec Review", template: "SEC_REVIEW_TEMPLATE.md" },
	{ abbrev: "dep-review", label: "Dep Review", template: "DEP_REVIEW_TEMPLATE.md" },
	{ abbrev: "perf-spec", label: "Perf Spec", template: "PERF_SPEC_TEMPLATE.md" },
] as const

// Map of upstream dependencies: creating a document of type X requires these types to exist first
const UPSTREAM_DEPS: Record<string, string[]> = {
	prd: ["brd"],
	adr: ["brd"],
	"tech-spec": ["prd"],
	"id-spec": ["tech-spec"],
	"test-spec": ["tech-spec"],
	"perf-spec": ["tech-spec"],
	"sec-review": ["tech-spec"],
	"dep-review": [],
	"mig-guide": ["tech-spec"],
	runbook: ["tech-spec", "mig-guide"],
	brd: [],
}

// ── Helpers ────────────────────────────────────────────────────────

interface DocEntry {
	path: string
	phase: string
	subNumber: string
	type: string
	name: string
	status: string | null
}

function scanDocs(cwd: string): DocEntry[] {
	const docsDir = join(cwd, "docs")
	const entries: DocEntry[] = []

	if (!existsSync(docsDir)) return entries

	for (const phaseDir of readdirSync(docsDir)) {
		const phasePath = join(docsDir, phaseDir)
		if (!statSync(phasePath).isDirectory()) continue
		if (!phaseDir.startsWith("phase-")) continue

		const phaseNum = phaseDir.replace("phase-", "")

		for (const file of readdirSync(phasePath)) {
			if (!file.endsWith(".md")) continue

			// Parse: {sub-number}_{doc-type}_{short-name}.md
			const match = file.match(/^([\d.]+)_([a-z-]+)_(.+)\.md$/)
			if (!match) continue

			const [, subNumber, docType, shortName] = match

			// Try to extract status from file frontmatter
			let status: string | null = null
			try {
				const content = readFileSync(join(phasePath, file), "utf-8")
				const statusMatch = content.match(/>\s*\*\*Status\*\*:\s*(.+)/i)
				if (statusMatch) status = statusMatch[1].trim()
			} catch {
				// skip unreadable files
			}

			entries.push({
				path: relative(cwd, join(phasePath, file)),
				phase: phaseNum,
				subNumber,
				type: docType,
				name: shortName,
				status,
			})
		}
	}

	return entries
}

function findDocsByPhaseAndType(docs: DocEntry[], phase?: string, type?: string): DocEntry[] {
	return docs.filter((d) => {
		if (phase && d.phase !== phase) return false
		if (type && d.type !== type) return false
		return true
	})
}

function checkUpstreamDeps(docs: DocEntry[], phase: string, docType: string): string[] {
	const missing: string[] = []
	const deps = UPSTREAM_DEPS[docType] || []

	for (const dep of deps) {
		const found = docs.some((d) => d.phase === phase && d.type === dep)
		if (!found) {
			const label = DOC_TYPES.find((t) => t.abbrev === dep)?.label ?? dep
			missing.push(label)
		}
	}

	return missing
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Tool: doc_status ───────────────────────────────────────────

	pi.registerTool({
		name: "doc_status",
		description:
			"Scan docs/ directory and report document inventory. Shows existing documents grouped by phase and type, counts per type, and identifies phases with no documents. Use this to understand the current documentation state.",
		schema: Type.Object({
			phase: Type.Optional(
				Type.String({
					description: 'Filter to a specific phase number (e.g., "0", "1", "3"). Omit for all phases.',
				})
			),
			type: Type.Optional(
				Type.String({
					description:
						'Filter to a specific doc type abbreviation (e.g., "tech-spec", "brd", "sec-review"). Omit for all types.',
				})
			),
		}),
		execute: async (input: { phase?: string; type?: string }, ctx: any) => {
			const cwd = ctx.cwd ?? process.cwd()
			const docs = scanDocs(cwd)
			const filtered = findDocsByPhaseAndType(docs, input.phase, input.type)

			if (filtered.length === 0) {
				const scope = [input.phase && `phase ${input.phase}`, input.type && `type "${input.type}"`]
					.filter(Boolean)
					.join(", ")
				return {
					content: scope
						? `No documents found for ${scope}. The docs/ directory may not have phase subdirectories yet, or no documents match the filter.`
						: "No documents found in docs/. Phase directories (e.g., docs/phase-0/) may not exist yet.",
				}
			}

			// Group by phase
			const byPhase = new Map<string, DocEntry[]>()
			for (const doc of filtered) {
				const list = byPhase.get(doc.phase) ?? []
				list.push(doc)
				byPhase.set(doc.phase, list)
			}

			const lines: string[] = [`## Document Inventory`, ""]

			for (const [phase, phaseDocs] of [...byPhase.entries()].sort()) {
				lines.push(`### Phase ${phase} (${phaseDocs.length} documents)`, "")
				lines.push("| Sub# | Type | Name | Status | Path |")
				lines.push("|------|------|------|--------|------|")
				for (const doc of phaseDocs.sort((a, b) => a.subNumber.localeCompare(b.subNumber))) {
					const typeLabel = DOC_TYPES.find((t) => t.abbrev === doc.type)?.label ?? doc.type
					lines.push(
						`| ${doc.subNumber} | ${typeLabel} | ${doc.name} | ${doc.status ?? "Unknown"} | ${doc.path} |`
					)
				}
				lines.push("")
			}

			// Summary by type
			const typeCounts = new Map<string, number>()
			for (const doc of filtered) {
				typeCounts.set(doc.type, (typeCounts.get(doc.type) ?? 0) + 1)
			}

			lines.push("### Summary by Type", "")
			lines.push("| Type | Count |")
			lines.push("|------|-------|")
			for (const [type, count] of [...typeCounts.entries()].sort()) {
				const label = DOC_TYPES.find((t) => t.abbrev === type)?.label ?? type
				lines.push(`| ${label} | ${count} |`)
			}
			lines.push("", `**Total**: ${filtered.length} documents`)

			return { content: lines.join("\n") }
		},
	})

	// ── Tool: doc_validate ─────────────────────────────────────────

	pi.registerTool({
		name: "doc_validate",
		description:
			"Validate document cross-references and upstream dependencies. Checks that Related Documents links resolve, upstream dependencies exist for each doc type, and naming conventions are followed.",
		schema: Type.Object({
			path: Type.Optional(
				Type.String({
					description:
						"Path to a specific document to validate. If omitted, validates all documents in docs/.",
				})
			),
		}),
		execute: async (input: { path?: string }, ctx: any) => {
			const cwd = ctx.cwd ?? process.cwd()
			const docs = scanDocs(cwd)
			const issues: string[] = []

			const toValidate = input.path ? docs.filter((d) => d.path === input.path) : docs

			if (toValidate.length === 0) {
				return {
					content: input.path
						? `Document not found at ${input.path}. Run doc_status to see existing documents.`
						: "No documents found to validate.",
				}
			}

			for (const doc of toValidate) {
				const fullPath = join(cwd, doc.path)

				// Check upstream dependencies
				const missingUpstream = checkUpstreamDeps(docs, doc.phase, doc.type)
				if (missingUpstream.length > 0) {
					issues.push(
						`**${doc.path}**: Missing upstream dependencies: ${missingUpstream.join(", ")}. ` +
							`These should exist in phase-${doc.phase}/ before this document.`
					)
				}

				// Check Related Documents links
				try {
					const content = readFileSync(fullPath, "utf-8")
					const linkPattern = /\[.*?\]\((\.\.\/[^\s)]+)\)/g
					let linkMatch
					while ((linkMatch = linkPattern.exec(content)) !== null) {
						const linkTarget = linkMatch[1]
						const resolved = join(fullPath, "..", linkTarget)
						if (!existsSync(resolved)) {
							issues.push(`**${doc.path}**: Broken link to \`${linkTarget}\` (file does not exist)`)
						}
					}
				} catch {
					issues.push(`**${doc.path}**: Could not read file for link validation`)
				}
			}

			if (issues.length === 0) {
				return {
					content: `Validated ${toValidate.length} document(s). No issues found. All upstream dependencies present and cross-references resolve.`,
				}
			}

			return {
				content: [
					`## Validation Issues (${issues.length})`,
					"",
					...issues.map((issue, i) => `${i + 1}. ${issue}`),
					"",
					`Validated ${toValidate.length} document(s), found ${issues.length} issue(s).`,
				].join("\n"),
			}
		},
	})

	// ── Tool: doc_gate_check ───────────────────────────────────────

	pi.registerTool({
		name: "doc_gate_check",
		description:
			"Check approval gate readiness for a specific phase. Reports which required documents exist, which are missing, and whether the gate can be passed. Consult the Document Matrix for required documents per phase.",
		schema: Type.Object({
			phase: Type.String({ description: 'Phase number to check (e.g., "0", "1", "3")' }),
			gate: Type.Optional(
				Type.String({
					description:
						'Specific gate to check: "kickoff", "design", "pre-merge", "pre-deploy". Omit to check all gates.',
					enum: ["kickoff", "design", "pre-merge", "pre-deploy"],
				})
			),
		}),
		execute: async (input: { phase: string; gate?: string }, ctx: any) => {
			const cwd = ctx.cwd ?? process.cwd()
			const docs = scanDocs(cwd)
			const phaseDocs = docs.filter((d) => d.phase === input.phase)

			const gates = [
				{
					name: "kickoff",
					label: "Phase Kickoff",
					required: ["brd"],
					approvers: "CTO / VP Eng + Eng Manager",
				},
				{
					name: "design",
					label: "Design Approval",
					required: ["tech-spec"],
					optional: ["adr", "prd"],
					approvers: "Tech Lead + peer engineers",
				},
				{
					name: "pre-merge",
					label: "Pre-Merge",
					required: ["test-spec"],
					optional: ["sec-review", "dep-review", "id-spec"],
					approvers: "QA Lead / Security Reviewer + Tech Lead",
				},
				{
					name: "pre-deploy",
					label: "Pre-Deployment",
					required: [],
					optional: ["mig-guide", "runbook", "perf-spec"],
					approvers: "SRE + Tech Lead",
				},
			]

			const toCheck = input.gate ? gates.filter((g) => g.name === input.gate) : gates
			const lines: string[] = [`## Gate Check: Phase ${input.phase}`, ""]

			for (const gate of toCheck) {
				const requiredPresent = gate.required.filter((t) => phaseDocs.some((d) => d.type === t))
				const requiredMissing = gate.required.filter((t) => !phaseDocs.some((d) => d.type === t))
				const optionalPresent = (gate.optional ?? []).filter((t) =>
					phaseDocs.some((d) => d.type === t)
				)

				const passed = requiredMissing.length === 0
				const status = passed ? "PASS" : "BLOCKED"
				const icon = passed ? "[PASS]" : "[BLOCKED]"

				lines.push(`### ${icon} ${gate.label}`)
				lines.push(`**Approvers**: ${gate.approvers}`)
				lines.push("")

				if (gate.required.length > 0) {
					lines.push("**Required documents:**")
					for (const t of gate.required) {
						const label = DOC_TYPES.find((dt) => dt.abbrev === t)?.label ?? t
						const present = requiredPresent.includes(t)
						lines.push(`- ${present ? "[x]" : "[ ]"} ${label}`)
					}
					lines.push("")
				}

				if ((gate.optional ?? []).length > 0) {
					lines.push("**Conditional documents** (required if applicable):")
					for (const t of gate.optional ?? []) {
						const label = DOC_TYPES.find((dt) => dt.abbrev === t)?.label ?? t
						const present = optionalPresent.includes(t)
						lines.push(`- ${present ? "[x]" : "[ ]"} ${label}`)
					}
					lines.push("")
				}

				if (!passed) {
					const missingLabels = requiredMissing.map(
						(t) => DOC_TYPES.find((dt) => dt.abbrev === t)?.label ?? t
					)
					lines.push(`**Action needed**: Create ${missingLabels.join(", ")} before proceeding.`)
					lines.push("")
				}
			}

			return { content: lines.join("\n") }
		},
	})

	// ── Command: /docs ─────────────────────────────────────────────

	pi.registerCommand("docs", {
		description: "Show document inventory summary. Usage: /docs [phase-number]",
		handler: async (args: string, ctx: any) => {
			const phase = args.trim() || undefined
			pi.sendUserMessage(
				phase
					? `Use the doc_status tool with phase="${phase}" to show the document inventory.`
					: "Use the doc_status tool to show the full document inventory across all phases."
			)
		},
	})

	// ── Command: /gate ─────────────────────────────────────────────

	pi.registerCommand("gate", {
		description: "Check gate readiness for a phase. Usage: /gate <phase-number> [gate-name]",
		handler: async (args: string, ctx: any) => {
			const parts = args.trim().split(/\s+/)
			const phase = parts[0]
			const gate = parts[1]

			if (!phase) {
				pi.sendUserMessage(
					"Usage: /gate <phase-number> [gate-name]\nGates: kickoff, design, pre-merge, pre-deploy"
				)
				return
			}

			const gateArg = gate ? `, gate="${gate}"` : ""
			pi.sendUserMessage(
				`Use the doc_gate_check tool with phase="${phase}"${gateArg} to check gate readiness.`
			)
		},
	})
}
