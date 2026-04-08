/**
 * sprint — Sprint planning and tracking extension for the Legal AI Platform.
 *
 * Provides:
 *   - `sprint_status` tool: report on the active sprint's progress
 *   - `sprint_update` tool: update a backlog item's status
 *   - `sprint_plan` tool: auto-generate a sprint backlog from roadmap phases
 *   - `/sprint` command: plan, execute, close, or inspect a sprint
 *   - `/standup` command: daily standup report from sprint state
 *   - `/retro` command: sprint retrospective
 *
 * State is persisted at .pi/state/sprints/sprint-{N}.yaml
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"

// ── Types ──────────────────────────────────────────────────────────

interface Sprint {
	id: number
	name: string
	goal: string
	startDate: string
	endDate: string
	roadmapPhases: string[]
	status: "planning" | "active" | "closed"
	backlog: BacklogItem[]
}

interface BacklogItem {
	id: string // e.g., "S1-001"
	title: string
	type: "doc" | "task" | "code"
	docType?: string // e.g., "brd", "tech-spec"
	phase?: string // e.g., "0", "1"
	assignee: string // role agent name
	chain?: string // chain to execute
	gate?: string // gate this item's completion unblocks
	status: "todo" | "in_progress" | "review" | "done" | "blocked"
	priority: "p0" | "p1" | "p2"
	dependsOn: string[] // backlog item IDs
	blockedReason?: string
	output?: string
	completedAt?: string
}

// ── Constants ──────────────────────────────────────────────────────

const DOC_TYPES = [
	{ abbrev: "brd", label: "BRD" },
	{ abbrev: "prd", label: "PRD" },
	{ abbrev: "adr", label: "ADR" },
	{ abbrev: "tech-spec", label: "Tech Spec" },
	{ abbrev: "id-spec", label: "ID Spec" },
	{ abbrev: "test-spec", label: "Test Spec" },
	{ abbrev: "sec-review", label: "Sec Review" },
	{ abbrev: "dep-review", label: "Dep Review" },
	{ abbrev: "mig-guide", label: "Mig Guide" },
	{ abbrev: "runbook", label: "Runbook" },
	{ abbrev: "perf-spec", label: "Perf Spec" },
] as const

/** Maps doc type → role agent responsible for producing it */
const DOC_ROLE_MAP: Record<string, string> = {
	brd: "pm",
	prd: "pm",
	adr: "tech-lead",
	"tech-spec": "tech-lead",
	"id-spec": "tech-lead",
	"test-spec": "qa",
	"sec-review": "security",
	"dep-review": "engineer",
	"mig-guide": "sre",
	runbook: "sre",
	"perf-spec": "sre",
}

/** Maps doc type → chain name (only types that have a dedicated chain) */
const DOC_CHAIN_MAP: Record<string, string> = {
	brd: "create-brd",
	"tech-spec": "create-tech-spec",
	"sec-review": "create-sec-review",
}

/** Maps doc type → the approval gate its completion contributes to */
const DOC_GATE_MAP: Record<string, string> = {
	brd: "kickoff",
	prd: "kickoff",
	adr: "kickoff",
	"tech-spec": "design",
	"test-spec": "pre-merge",
	"sec-review": "pre-merge",
	"dep-review": "pre-merge",
	"id-spec": "pre-merge",
	"mig-guide": "pre-deploy",
	runbook: "pre-deploy",
	"perf-spec": "pre-deploy",
}

/** Maps doc type → upstream doc types required before this one can be started */
const UPSTREAM_DEPS: Record<string, string[]> = {
	prd: ["brd"],
	adr: ["brd"],
	"tech-spec": ["prd"],
	"id-spec": ["tech-spec"],
	"test-spec": ["tech-spec"],
	"perf-spec": ["tech-spec"],
	"sec-review": ["tech-spec"],
	"mig-guide": ["tech-spec"],
	runbook: ["tech-spec", "mig-guide"],
	"dep-review": [],
	brd: [],
}

/** Priority assigned to each doc type */
const DOC_PRIORITY_MAP: Record<string, "p0" | "p1" | "p2"> = {
	brd: "p0",
	prd: "p1",
	adr: "p1",
	"tech-spec": "p1",
	"id-spec": "p2",
	"test-spec": "p2",
	"sec-review": "p2",
	"dep-review": "p2",
	"mig-guide": "p2",
	runbook: "p2",
	"perf-spec": "p2",
}

// ── Helpers ────────────────────────────────────────────────────────

function getSprintsDir(cwd: string): string {
	return join(cwd, ".pi", "state", "sprints")
}

function getSprintPath(cwd: string, id: number): string {
	return join(getSprintsDir(cwd), `sprint-${id}.yaml`)
}

function ensureSprintsDir(cwd: string): void {
	const dir = getSprintsDir(cwd)
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/**
 * Load a sprint by ID. Returns null if the file does not exist or cannot be parsed.
 */
function loadSprint(cwd: string, id: number): Sprint | null {
	const path = getSprintPath(cwd, id)
	if (!existsSync(path)) return null
	try {
		return parseYaml(readFileSync(path, "utf-8")) as Sprint
	} catch {
		return null
	}
}

/**
 * Save a sprint to disk, creating the directory if needed.
 */
function saveSprint(cwd: string, sprint: Sprint): void {
	ensureSprintsDir(cwd)
	writeFileSync(getSprintPath(cwd, sprint.id), stringifyYaml(sprint), "utf-8")
}

/**
 * Resolve the next sprint ID by checking existing sprint files.
 */
function nextSprintId(cwd: string): number {
	ensureSprintsDir(cwd)
	const dir = getSprintsDir(cwd)
	let max = 0
	try {
		for (const file of readdirSync(dir)) {
			const match = file.match(/^sprint-(\d+)\.yaml$/)
			if (match) {
				const n = parseInt(match[1], 10)
				if (n > max) max = n
			}
		}
	} catch {
		// directory is empty or unreadable
	}
	return max + 1
}

/**
 * Load the most recently created active sprint. Falls back to the highest-numbered sprint.
 */
function loadActiveSprint(cwd: string): Sprint | null {
	ensureSprintsDir(cwd)
	const dir = getSprintsDir(cwd)
	let ids: number[] = []
	try {
		ids = readdirSync(dir)
			.map((f) => f.match(/^sprint-(\d+)\.yaml$/))
			.filter((m): m is RegExpMatchArray => m !== null)
			.map((m) => parseInt(m[1], 10))
			.sort((a, b) => a - b)
	} catch {
		return null
	}

	if (ids.length === 0) return null

	// Prefer the first active sprint found; fall back to highest ID
	for (const id of ids) {
		const sprint = loadSprint(cwd, id)
		if (sprint?.status === "active") return sprint
	}

	// No active sprint — return the most recent one for visibility
	return loadSprint(cwd, ids[ids.length - 1])
}

/**
 * Build a progress bar string. e.g. "[████████░░░░] 8/12 (67%)"
 */
function progressBar(done: number, total: number, width = 20): string {
	if (total === 0) return `[${" ".repeat(width)}] 0/0`
	const filled = Math.round((done / total) * width)
	const bar = "█".repeat(filled) + "░".repeat(width - filled)
	const pct = Math.round((done / total) * 100)
	return `[${bar}] ${done}/${total} (${pct}%)`
}

/**
 * Format a sprint into a human-readable summary table.
 */
function formatSprintSummary(sprint: Sprint): string {
	const total = sprint.backlog.length
	const byStatus = {
		todo: sprint.backlog.filter((i) => i.status === "todo").length,
		in_progress: sprint.backlog.filter((i) => i.status === "in_progress").length,
		review: sprint.backlog.filter((i) => i.status === "review").length,
		done: sprint.backlog.filter((i) => i.status === "done").length,
		blocked: sprint.backlog.filter((i) => i.status === "blocked").length,
	}
	const done = byStatus.done
	const blockers = sprint.backlog.filter((i) => i.status === "blocked")

	const lines: string[] = [
		`## Sprint ${sprint.id}: ${sprint.name}`,
		`**Status**: ${sprint.status}   **Goal**: ${sprint.goal}`,
		`**Dates**: ${sprint.startDate} → ${sprint.endDate}`,
		`**Phases**: ${sprint.roadmapPhases.join(", ")}`,
		"",
		`**Progress**: ${progressBar(done, total)}`,
		"",
		"| Status | Count |",
		"|--------|-------|",
		`| Todo | ${byStatus.todo} |`,
		`| In Progress | ${byStatus.in_progress} |`,
		`| Review | ${byStatus.review} |`,
		`| Done | ${byStatus.done} |`,
		`| Blocked | ${byStatus.blocked} |`,
		"",
	]

	if (sprint.backlog.length > 0) {
		lines.push("### Backlog")
		lines.push("")
		lines.push("| ID | Priority | Title | Assignee | Gate | Status |")
		lines.push("|----|----------|-------|----------|------|--------|")
		for (const item of sprint.backlog) {
			const gateLabel = item.gate ?? "—"
			const reason = item.blockedReason ? ` _(${item.blockedReason})_` : ""
			lines.push(
				`| ${item.id} | ${item.priority.toUpperCase()} | ${item.title} | ${item.assignee} | ${gateLabel} | ${item.status}${reason} |`
			)
		}
		lines.push("")
	}

	if (blockers.length > 0) {
		lines.push("### Blockers")
		lines.push("")
		for (const item of blockers) {
			lines.push(
				`- **${item.id}** ${item.title}: ${item.blockedReason ?? "No reason specified"}` +
					(item.dependsOn.length > 0 ? ` _(depends on: ${item.dependsOn.join(", ")})_` : "")
			)
		}
		lines.push("")
	}

	return lines.join("\n")
}

/**
 * Scan docs/phase-{N}/ to determine which doc types already exist.
 */
function getExistingDocTypes(cwd: string, phase: string): Set<string> {
	const phaseDir = join(cwd, "docs", `phase-${phase}`)
	const found = new Set<string>()
	if (!existsSync(phaseDir)) return found
	try {
		for (const file of readdirSync(phaseDir)) {
			const match = file.match(/^[\d.]+_([a-z-]+)_/)
			if (match) found.add(match[1])
		}
	} catch {
		// unreadable — return empty
	}
	return found
}

/**
 * Auto-unblock items whose upstream dependsOn are all done.
 * Mutates the sprint.backlog in place and returns count of items unblocked.
 */
function autoUnblock(sprint: Sprint): number {
	const doneIds = new Set(sprint.backlog.filter((i) => i.status === "done").map((i) => i.id))
	let count = 0
	for (const item of sprint.backlog) {
		if (item.status !== "blocked") continue
		const allDepsDone = item.dependsOn.every((dep) => doneIds.has(dep))
		if (allDepsDone) {
			item.status = "todo"
			delete item.blockedReason
			count++
		}
	}
	return count
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Tool: sprint_status ─────────────────────────────────────────

	pi.registerTool({
		name: "sprint_status",
		label: "Sprint Status",
		description:
			"Show the current active sprint's progress — name, goal, dates, progress bar, item breakdown by status, and any blockers. Always reads the most recent active sprint from .pi/state/sprints/.",
		parameters: Type.Object({}),
		execute: async (
			_toolCallId: string,
			_params: Record<string, never>,
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd: string = _ctx.cwd ?? process.cwd()
			const sprint = loadActiveSprint(cwd)

			if (!sprint) {
				return {
					content: [
						{
							type: "text",
							text: "No sprint found. Use the sprint_plan tool or /sprint plan <phases> to create one.",
						},
					],
				}
			}

			return { content: [{ type: "text", text: formatSprintSummary(sprint) }] }
		},
	})

	// ── Tool: sprint_update ─────────────────────────────────────────

	pi.registerTool({
		name: "sprint_update",
		label: "Sprint Update",
		description:
			"Update a backlog item's status in the active sprint. When an item is marked done, automatically unblocks items whose upstream dependencies are now satisfied and emits a sprint:item-complete event.",
		parameters: Type.Object({
			itemId: Type.String({
				description: 'The backlog item ID to update (e.g., "S1-001")',
			}),
			status: Type.String({
				description: "New status for the item",
				enum: ["todo", "in_progress", "review", "done", "blocked"],
			}),
			note: Type.Optional(
				Type.String({
					description:
						"Optional note — for 'done' this can be the output path or summary; for 'blocked' this should be the reason",
				})
			),
		}),
		execute: async (
			_toolCallId: string,
			params: { itemId: string; status: string; note?: string },
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd: string = _ctx.cwd ?? process.cwd()
			const sprint = loadActiveSprint(cwd)

			if (!sprint) {
				return {
					content: [
						{
							type: "text",
							text: "No active sprint found. Cannot update item.",
						},
					],
				}
			}

			const item = sprint.backlog.find((i) => i.id === params.itemId)
			if (!item) {
				const ids = sprint.backlog.map((i) => i.id).join(", ")
				return {
					content: [
						{
							type: "text",
							text: `Item "${params.itemId}" not found in sprint ${sprint.id}. Available IDs: ${ids}`,
						},
					],
				}
			}

			const prevStatus = item.status
			item.status = params.status as BacklogItem["status"]

			if (params.status === "done") {
				item.completedAt = new Date().toISOString()
				if (params.note) item.output = params.note
				delete item.blockedReason

				// Notify TUI
				pi.events.emit("sprint:item-complete", { id: item.id, title: item.title })

				// Auto-unblock items whose dependencies are now fully met
				const unblocked = autoUnblock(sprint)
				saveSprint(cwd, sprint)

				const lines: string[] = [
					`Updated **${item.id}** (${item.title}): ${prevStatus} → done`,
					`Completed at: ${item.completedAt}`,
				]
				if (unblocked > 0) {
					lines.push(
						``,
						`Auto-unblocked ${unblocked} item(s) whose upstream dependencies are now satisfied.`
					)
				}
				lines.push(``, formatSprintSummary(sprint))
				return { content: [{ type: "text", text: lines.join("\n") }] }
			}

			if (params.status === "blocked" && params.note) {
				item.blockedReason = params.note
			}

			if (params.status !== "blocked") {
				delete item.blockedReason
			}

			saveSprint(cwd, sprint)

			return {
				content: [
					{
						type: "text",
						text: [
							`Updated **${item.id}** (${item.title}): ${prevStatus} → ${params.status}`,
							params.note ? `Note: ${params.note}` : "",
							``,
							formatSprintSummary(sprint),
						]
							.filter(Boolean)
							.join("\n"),
					},
				],
			}
		},
	})

	// ── Tool: sprint_plan ───────────────────────────────────────────

	pi.registerTool({
		name: "sprint_plan",
		label: "Sprint Plan",
		description:
			"Auto-generate a sprint backlog by scanning docs/phase-{N}/ for existing documents and creating BacklogItems for each missing doc type across the requested phases. Saves the sprint to .pi/state/sprints/sprint-{N}.yaml.",
		parameters: Type.Object({
			phases: Type.String({
				description:
					'Comma-separated phase numbers to include (e.g., "0,1" or "2"). One backlog item per missing document type per phase.',
			}),
			sprintName: Type.String({
				description: 'Short name for the sprint (e.g., "Foundation Docs Sprint")',
			}),
			sprintGoal: Type.String({
				description: "One-sentence goal statement for the sprint",
			}),
		}),
		execute: async (
			_toolCallId: string,
			params: { phases: string; sprintName: string; sprintGoal: string },
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd: string = _ctx.cwd ?? process.cwd()
			const sprintId = nextSprintId(cwd)

			// Derive sprint date range: today + 14 days
			const today = new Date()
			const endDate = new Date(today)
			endDate.setDate(today.getDate() + 14)
			const fmt = (d: Date) => d.toISOString().slice(0, 10)

			const phases = params.phases
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)

			const backlog: BacklogItem[] = []
			let counter = 0

			// Phase 1: gather all items, assign IDs
			// We need IDs before we can resolve dependsOn references within the same sprint.
			// Strategy: first pass to build a (phase, docType) → itemId map,
			// second pass to set dependsOn correctly.

			interface PendingItem {
				phase: string
				docType: string
				item: BacklogItem
			}
			const pending: PendingItem[] = []
			const itemIdMap = new Map<string, string>() // key: "{phase}/{docType}" → itemId

			for (const phase of phases) {
				const existingTypes = getExistingDocTypes(cwd, phase)

				for (const { abbrev } of DOC_TYPES) {
					if (existingTypes.has(abbrev)) {
						// Already exists — record its virtual presence so dependsOn can skip it
						itemIdMap.set(`${phase}/${abbrev}`, `EXISTING:${phase}/${abbrev}`)
						continue
					}

					counter++
					const paddedId = String(counter).padStart(3, "0")
					const itemId = `S${sprintId}-${paddedId}`

					itemIdMap.set(`${phase}/${abbrev}`, itemId)

					const typeLabel = DOC_TYPES.find((t) => t.abbrev === abbrev)?.label ?? abbrev

					const item: BacklogItem = {
						id: itemId,
						title: `Create Phase ${phase} ${typeLabel}`,
						type: "doc",
						docType: abbrev,
						phase,
						assignee: DOC_ROLE_MAP[abbrev] ?? "engineer",
						chain: DOC_CHAIN_MAP[abbrev],
						gate: DOC_GATE_MAP[abbrev],
						status: "todo", // may be overridden to "blocked" below
						priority: DOC_PRIORITY_MAP[abbrev] ?? "p2",
						dependsOn: [],
					}

					pending.push({ phase, docType: abbrev, item })
					backlog.push(item)
				}
			}

			// Second pass: resolve dependsOn using the itemIdMap
			for (const { phase, docType, item } of pending) {
				const upstreamTypes = UPSTREAM_DEPS[docType] ?? []
				const deps: string[] = []

				for (const upstreamType of upstreamTypes) {
					const key = `${phase}/${upstreamType}`
					const upstreamId = itemIdMap.get(key)

					if (upstreamId) {
						if (!upstreamId.startsWith("EXISTING:")) {
							// Upstream is also being created in this sprint — depend on it
							deps.push(upstreamId)
						}
						// If EXISTING, the upstream doc is already present — no dependency needed
					} else {
						// Upstream is not in this sprint and doesn't exist on disk
						// Mark this item as blocked
						item.status = "blocked"
						item.blockedReason = `Missing upstream: ${upstreamType} (not found in docs/phase-${phase}/ and not in this sprint)`
					}
				}

				item.dependsOn = deps
			}

			const sprint: Sprint = {
				id: sprintId,
				name: params.sprintName,
				goal: params.sprintGoal,
				startDate: fmt(today),
				endDate: fmt(endDate),
				roadmapPhases: phases,
				status: "active",
				backlog,
			}

			saveSprint(cwd, sprint)

			// Format output grouped by priority
			const p0 = backlog.filter((i) => i.priority === "p0")
			const p1 = backlog.filter((i) => i.priority === "p1")
			const p2 = backlog.filter((i) => i.priority === "p2")

			const lines: string[] = [
				`## Sprint ${sprintId}: ${params.sprintName}`,
				`**Goal**: ${params.sprintGoal}`,
				`**Dates**: ${fmt(today)} → ${fmt(endDate)}`,
				`**Phases**: ${phases.join(", ")}`,
				`**Total items**: ${backlog.length}`,
				``,
			]

			const formatGroup = (items: BacklogItem[], label: string) => {
				if (items.length === 0) return
				lines.push(`### ${label} (${items.length})`, "")
				lines.push("| ID | Title | Assignee | Chain | Gate | Depends On | Status |")
				lines.push("|----|-------|----------|-------|------|-----------|--------|")
				for (const item of items) {
					const chain = item.chain ?? "—"
					const gate = item.gate ?? "—"
					const deps = item.dependsOn.length > 0 ? item.dependsOn.join(", ") : "—"
					lines.push(
						`| ${item.id} | ${item.title} | ${item.assignee} | ${chain} | ${gate} | ${deps} | ${item.status} |`
					)
				}
				lines.push("")
			}

			formatGroup(p0, "P0 — Critical")
			formatGroup(p1, "P1 — High")
			formatGroup(p2, "P2 — Standard")

			lines.push(
				`Sprint saved to \`.pi/state/sprints/sprint-${sprintId}.yaml\`.`,
				`Run \`/sprint execute\` to begin dispatching items in dependency order.`
			)

			return { content: [{ type: "text", text: lines.join("\n") }] }
		},
	})

	// ── Command: /sprint ────────────────────────────────────────────

	pi.registerCommand("sprint", {
		description:
			"Sprint management. Usage: /sprint [status|plan <phases>|execute|close]. Default: status.",
		handler: async (args: string, _ctx: any) => {
			const parts = args.trim().split(/\s+/)
			const action = parts[0] || "status"

			switch (action) {
				case "status":
					pi.sendUserMessage(
						"Use the sprint_status tool to show the current sprint's progress, then present it clearly."
					)
					break

				case "plan": {
					const phasesArg = parts.slice(1).join(",").trim()
					if (!phasesArg) {
						pi.sendUserMessage(
							"Usage: /sprint plan <phases>\n\n" +
								"Examples:\n" +
								"  /sprint plan 0        — Plan a sprint for Phase 0\n" +
								"  /sprint plan 0,1      — Plan a sprint covering Phases 0 and 1\n\n" +
								"Provide the phase numbers to plan a sprint."
						)
						return
					}
					pi.sendUserMessage(
						`Use the sprint_plan tool to generate a sprint for phases "${phasesArg}".\n\n` +
							`Before calling the tool, ask the user for:\n` +
							`1. Sprint name (e.g., "Foundation Docs Sprint")\n` +
							`2. Sprint goal (one sentence)\n\n` +
							`Then call sprint_plan with phases="${phasesArg}", and the name and goal the user provides. ` +
							`After generating, present the plan and ask for approval before proceeding.`
					)
					break
				}

				case "execute":
					pi.sendUserMessage(
						`Use sprint_status to read the active sprint backlog. Then:\n\n` +
							`1. Topologically sort backlog items by their dependsOn fields\n` +
							`2. Group items into parallel waves: items with no unmet dependencies go in Wave 1, ` +
							`items whose deps are all in Wave 1 go in Wave 2, and so on\n` +
							`3. For each wave:\n` +
							`   a. Update each item to "in_progress" via sprint_update\n` +
							`   b. Dispatch each item using the dispatch tool:\n` +
							`      - If the item has a chain field: dispatch type="chain", target=chain, input=item.title\n` +
							`      - Otherwise: dispatch type="agent", target=item.assignee, input=item.title\n` +
							`   c. After dispatch completes, update item to "done" or "review" via sprint_update\n` +
							`   d. Check if any blocked items can now proceed\n` +
							`4. After all waves complete, report final sprint summary\n\n` +
							`Present the wave plan to the user before dispatching. Wait for approval.`
					)
					break

				case "close":
					pi.sendUserMessage(
						`Read the active sprint using sprint_status. Then:\n\n` +
							`1. Mark the sprint as closed (update any remaining in_progress items appropriately)\n` +
							`2. Produce a retrospective summary:\n` +
							`   - Items completed vs planned\n` +
							`   - Blockers encountered and whether resolved\n` +
							`   - Velocity (items per day)\n` +
							`   - Recommendations for the next sprint\n` +
							`3. Update the sprint status to "closed" in the YAML file by calling sprint_update for each ` +
							`item still in progress, then note that the sprint is now closed.\n\n` +
							`Present the retrospective to the user.`
					)
					break

				default:
					pi.sendUserMessage(
						`Unknown sprint action: "${action}"\n\n` +
							`Usage: /sprint [status|plan <phases>|execute|close]\n\n` +
							`  status          — Show current sprint (default)\n` +
							`  plan <phases>   — Plan a sprint (e.g., /sprint plan 0,1)\n` +
							`  execute         — Execute sprint backlog in dependency order\n` +
							`  close           — Close the sprint and generate summary`
					)
			}
		},
	})

	// ── Command: /standup ───────────────────────────────────────────

	pi.registerCommand("standup", {
		description: "Daily standup report from current sprint state.",
		handler: async (_args: string, _ctx: any) => {
			pi.sendUserMessage(
				`Use the sprint_status tool to get the current sprint state. Then present it as a daily standup report with these exact sections:\n\n` +
					`**Done** (completed since last check):\n- List items with their completedAt timestamp\n\n` +
					`**In Progress**:\n- List items currently in_progress or review\n\n` +
					`**Blocked**:\n- List blocked items with their blockedReason and what needs to happen to unblock them\n\n` +
					`**Risks**:\n- Flag any items that may miss the sprint end date based on remaining work\n` +
					`- Mention if more than 30% of backlog is blocked`
			)
		},
	})

	// ── Command: /retro ─────────────────────────────────────────────

	pi.registerCommand("retro", {
		description: "Generate a sprint retrospective from the current sprint state.",
		handler: async (_args: string, _ctx: any) => {
			pi.sendUserMessage(
				`Use the sprint_status tool to read the sprint state. Then produce a sprint retrospective with these sections:\n\n` +
					`## Summary\n- Sprint name and goal\n- Completed: N/M items (X%)\n- Duration: startDate → endDate\n\n` +
					`## What Shipped\n- List completed items with assignee, gate they unblock, and completedAt time\n\n` +
					`## What Didn't Ship\n- List incomplete/blocked items with reasons\n\n` +
					`## Blockers Encountered\n- List all blockers and how they were (or weren't) resolved\n\n` +
					`## Velocity\n- Items completed per day\n- Average time per item (if completedAt data allows)\n\n` +
					`## Recommendations\n- What to carry over to the next sprint\n- What to do differently\n- Gate readiness: which gates can now be passed`
			)
		},
	})
}
