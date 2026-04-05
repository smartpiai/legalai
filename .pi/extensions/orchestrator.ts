/**
 * orchestrator — Meta-agent coordination layer.
 *
 * Provides:
 *   - `/orchestrate` command: invoke the project orchestrator
 *   - `/phase` command: invoke the phase orchestrator for a specific phase
 *   - `/route` command: manually route a request through routing.yaml
 *   - `dispatch` tool: programmatic chain/team invocation from orchestrator agents
 *   - Event bus channels for inter-agent state passing
 *   - Progress tracking via .pi/state/progress.yaml
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"

// ── Types ──────────────────────────────────────────────────────────

interface RoutingRule {
	match: string
	route: "chain" | "team" | "agent" | "decompose"
	target: string
	skill?: string
	description: string
}

interface ProgressState {
	phase?: string
	startedAt: string
	waves: Wave[]
	completed: string[]
	inProgress: string[]
	blocked: BlockedItem[]
}

interface Wave {
	number: number
	status: "pending" | "in_progress" | "completed"
	tasks: WaveTask[]
}

interface WaveTask {
	chain: string
	docType: string
	status: "pending" | "in_progress" | "completed" | "failed"
	output?: string
	error?: string
}

interface BlockedItem {
	docType: string
	reason: string
	blockedBy: string[]
}

// ── Helpers ────────────────────────────────────────────────────────

function loadRoutingRules(cwd: string): RoutingRule[] {
	const rulesPath = join(cwd, ".pi", "agents", "routing.yaml")
	if (!existsSync(rulesPath)) return []
	try {
		const content = readFileSync(rulesPath, "utf-8")
		return parseYaml(content) as RoutingRule[]
	} catch {
		return []
	}
}

function matchRoute(input: string, rules: RoutingRule[]): RoutingRule | null {
	const normalized = input.toLowerCase().trim()
	for (const rule of rules) {
		try {
			const regex = new RegExp(rule.match, "i")
			if (regex.test(normalized)) return rule
		} catch {
			// skip invalid regex
		}
	}
	return null
}

function getStatePath(cwd: string): string {
	return join(cwd, ".pi", "state", "progress.yaml")
}

function loadProgress(cwd: string): ProgressState | null {
	const statePath = getStatePath(cwd)
	if (!existsSync(statePath)) return null
	try {
		return parseYaml(readFileSync(statePath, "utf-8")) as ProgressState
	} catch {
		return null
	}
}

function saveProgress(cwd: string, state: ProgressState): void {
	const stateDir = join(cwd, ".pi", "state")
	if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })
	writeFileSync(getStatePath(cwd), stringifyYaml(state), "utf-8")
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Tool: dispatch ─────────────────────────────────────────────
	// Used by orchestrator agents to programmatically invoke chains/teams

	pi.registerTool({
		name: "dispatch",
		description:
			"Dispatch work to an agent chain, team, or individual agent. Used by orchestrator agents to coordinate multi-agent workflows. Returns a description of what would be invoked — the orchestrator then communicates this plan to the user.",
		parameters: Type.Object({
			type: Type.String({
				description: 'What to invoke: "chain", "team", or "agent"',
				enum: ["chain", "team", "agent"],
			}),
			target: Type.String({
				description: "Name of the chain, team, or agent to invoke",
			}),
			input: Type.String({
				description: "The prompt/context to pass to the invoked composition",
			}),
			skill: Type.Optional(
				Type.String({
					description: "Skill to activate for the target agent (only for type=agent)",
				})
			),
		}),
		execute: async (
			_toolCallId: string,
			params: { type: string; target: string; input: string; skill?: string },
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd = _ctx.cwd ?? process.cwd()

			// Read the composition definitions
			if (params.type === "chain") {
				const chainsPath = join(cwd, ".pi", "agents", "chains.yaml")
				if (!existsSync(chainsPath)) {
					return { content: [{ type: "text", text: "Error: chains.yaml not found" }] }
				}
				const chains = parseYaml(readFileSync(chainsPath, "utf-8")) as Record<string, any[]>
				const chain = chains[params.target]
				if (!chain) {
					return {
						content: [{ type: "text", text: `Error: chain "${params.target}" not found. Available: ${Object.keys(chains).join(", ")}` }],
					}
				}

				const steps = chain.map((step: any, i: number) => `  Step ${i + 1}: ${step.agent}`).join("\n")
				return {
					content: [{ type: "text", text: [
						`## Dispatch: Chain "${params.target}"`,
						"",
						`**Steps:**`,
						steps,
						"",
						`**Input:** ${params.input.substring(0, 200)}...`,
						"",
						`To execute this chain, invoke each agent in sequence, passing the output of each step as $INPUT to the next.`,
						`The chain definition in .pi/agents/chains.yaml contains the exact prompts for each step.`,
					].join("\n") }],
				}
			}

			if (params.type === "team") {
				const teamsPath = join(cwd, ".pi", "agents", "teams.yaml")
				if (!existsSync(teamsPath)) {
					return { content: [{ type: "text", text: "Error: teams.yaml not found" }] }
				}
				const teams = parseYaml(readFileSync(teamsPath, "utf-8")) as Record<string, string[]>
				const team = teams[params.target]
				if (!team) {
					return {
						content: [{ type: "text", text: `Error: team "${params.target}" not found. Available: ${Object.keys(teams).join(", ")}` }],
					}
				}

				return {
					content: [{ type: "text", text: [
						`## Dispatch: Team "${params.target}"`,
						"",
						`**Agents (parallel):** ${team.join(", ")}`,
						"",
						`**Input:** ${params.input.substring(0, 200)}...`,
						"",
						`To execute this team, invoke all agents simultaneously with the same input and collect their outputs.`,
					].join("\n") }],
				}
			}

			if (params.type === "agent") {
				const skillNote = params.skill ? ` with skill "${params.skill}"` : ""
				return {
					content: [{ type: "text", text: [
						`## Dispatch: Agent "${params.target}"${skillNote}`,
						"",
						`**Input:** ${params.input.substring(0, 200)}...`,
						"",
						`To execute, invoke the ${params.target} agent${skillNote} with the provided input.`,
					].join("\n") }],
				}
			}

			return { content: [{ type: "text", text: `Error: unknown dispatch type "${params.type}"` }] }
		},
	})

	// ── Tool: route ────────────────────────────────────────────────
	// Analyzes input and recommends the best routing based on routing.yaml

	pi.registerTool({
		name: "route",
		description:
			"Analyze a user request and recommend the best routing (chain, team, or agent) based on the routing rules in .pi/agents/routing.yaml. Returns the matched rule and recommended invocation.",
		parameters: Type.Object({
			request: Type.String({ description: "The user's request to route" }),
		}),
		execute: async (
			_toolCallId: string,
			params: { request: string },
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd = _ctx.cwd ?? process.cwd()
			const rules = loadRoutingRules(cwd)

			if (rules.length === 0) {
				return { content: [{ type: "text", text: "No routing rules found. Check .pi/agents/routing.yaml" }] }
			}

			const matched = matchRoute(params.request, rules)

			if (!matched) {
				return {
					content: [{ type: "text", text: `No routing rule matched "${params.request}". Falling back to default agent.` }],
				}
			}

			const lines = [
				`## Routing Result`,
				"",
				`**Request:** "${params.request}"`,
				`**Matched rule:** \`${matched.match}\``,
				`**Route type:** ${matched.route}`,
				`**Target:** ${matched.target}`,
			]

			if (matched.skill) {
				lines.push(`**Skill:** ${matched.skill}`)
			}

			lines.push(`**Description:** ${matched.description}`)
			lines.push("")

			switch (matched.route) {
				case "chain":
					lines.push(
						`**Action:** Invoke the \`${matched.target}\` chain from chains.yaml.`,
						`Each step runs sequentially, passing output to the next agent.`
					)
					break
				case "team":
					lines.push(
						`**Action:** Invoke the \`${matched.target}\` team from teams.yaml.`,
						`All agents run in parallel and produce independent outputs.`
					)
					break
				case "agent":
					lines.push(
						`**Action:** Invoke the \`${matched.target}\` agent directly.`,
						matched.skill
							? `Activate the \`${matched.skill}\` skill for guided workflow.`
							: ""
					)
					break
				case "decompose":
					lines.push(
						`**Action:** Route to \`${matched.target}\` for task decomposition.`,
						`The orchestrator will break this into sub-tasks and execute them in dependency order.`
					)
					break
			}

			return { content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] }
		},
	})

	// ── Tool: progress ─────────────────────────────────────────────
	// Read and update orchestration progress state

	pi.registerTool({
		name: "progress",
		description:
			"Read or update the orchestration progress tracker at .pi/state/progress.yaml. Used by orchestrators to track multi-chain execution state.",
		parameters: Type.Object({
			action: Type.String({
				description: '"read" to get current state, "update" to modify it',
				enum: ["read", "update"],
			}),
			phase: Type.Optional(Type.String({ description: "Phase number for scoping" })),
			taskId: Type.Optional(
				Type.String({ description: 'Task to update (format: "chain:docType")' })
			),
			status: Type.Optional(
				Type.String({
					description: "New status for the task",
					enum: ["pending", "in_progress", "completed", "failed"],
				})
			),
			note: Type.Optional(Type.String({ description: "Note to attach to the update" })),
		}),
		execute: async (
			_toolCallId: string,
			params: {
				action: string
				phase?: string
				taskId?: string
				status?: string
				note?: string
			},
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd = _ctx.cwd ?? process.cwd()

			if (params.action === "read") {
				const state = loadProgress(cwd)
				if (!state) {
					return {
						content: [{ type: "text", text: "No progress state found. Start an orchestration to create one." }],
					}
				}
				return { content: [{ type: "text", text: stringifyYaml(state) }] }
			}

			if (params.action === "update") {
				let state = loadProgress(cwd) || {
					phase: params.phase,
					startedAt: new Date().toISOString(),
					waves: [],
					completed: [],
					inProgress: [],
					blocked: [],
				}

				if (params.taskId && params.status) {
					// Update task status
					for (const wave of state.waves) {
						for (const task of wave.tasks) {
							const taskKey = `${task.chain}:${task.docType}`
							if (taskKey === params.taskId) {
								task.status = params.status as WaveTask["status"]
								if (params.note) task.output = params.note
							}
						}
					}

					// Update summary lists
					state.completed = state.waves
						.flatMap((w) => w.tasks)
						.filter((t) => t.status === "completed")
						.map((t) => `${t.chain}:${t.docType}`)

					state.inProgress = state.waves
						.flatMap((w) => w.tasks)
						.filter((t) => t.status === "in_progress")
						.map((t) => `${t.chain}:${t.docType}`)
				}

				saveProgress(cwd, state)
				return { content: [{ type: "text", text: `Progress updated.\n\n${stringifyYaml(state)}` }] }
			}

			return { content: [{ type: "text", text: `Unknown action: ${params.action}` }] }
		},
	})

	// ── Command: /orchestrate ──────────────────────────────────────

	pi.registerCommand("orchestrate", {
		description:
			"Invoke the project orchestrator. Usage: /orchestrate <request>. The orchestrator will analyze your request, determine the best routing, and present an execution plan.",
		handler: async (args: string, ctx: any) => {
			if (!args.trim()) {
				pi.sendUserMessage(
					"Usage: /orchestrate <what you want to accomplish>\n\n" +
						"Examples:\n" +
						'  /orchestrate "Get Phase 3 ready for kickoff"\n' +
						'  /orchestrate "Create all missing docs for Phase 1"\n' +
						'  /orchestrate "Run a security audit on the agent endpoints"\n' +
						'  /orchestrate "Review everything before we deploy Phase 2"'
				)
				return
			}

			// Route the request, then invoke the project orchestrator
			pi.sendUserMessage(
				`Use the \`route\` tool to analyze this request: "${args.trim()}"\n\n` +
					`Then, acting as the project-orchestrator agent (read .pi/agents/orchestrators/project.md for your instructions), ` +
					`create an execution plan based on the routing result. Present the plan to the user for approval before dispatching any work.`
			)
		},
	})

	// ── Command: /phase ────────────────────────────────────────────

	pi.registerCommand("phase", {
		description:
			"Invoke the phase orchestrator. Usage: /phase <number> [action]. Actions: status, plan, execute, review.",
		handler: async (args: string, ctx: any) => {
			const parts = args.trim().split(/\s+/)
			const phaseNum = parts[0]
			const action = parts[1] || "status"

			if (!phaseNum) {
				pi.sendUserMessage(
					"Usage: /phase <number> [action]\n\n" +
						"Actions:\n" +
						"  status  — Show current documentation state (default)\n" +
						"  plan    — Create an execution plan for all missing docs\n" +
						"  execute — Execute the plan (creates docs in dependency order)\n" +
						"  review  — Review all existing docs for quality"
				)
				return
			}

			pi.sendUserMessage(
				`Acting as the phase-orchestrator agent (read .pi/agents/orchestrators/phase.md), ` +
					`perform "${action}" for Phase ${phaseNum}.\n\n` +
					`Start by running doc_status with phase="${phaseNum}" and doc_gate_check with phase="${phaseNum}" ` +
					`to assess the current state. Then follow the phase orchestrator's workflow for the "${action}" action.`
			)
		},
	})

	// ── Event bus: inter-agent communication ───────────────────────

	// Agents can publish findings that other agents subscribe to
	pi.on("agent:finding", (data: any) => {
		// Store findings for cross-agent access
		const cwd = process.cwd()
		const findingsDir = join(cwd, ".pi", "state", "findings")
		if (!existsSync(findingsDir)) mkdirSync(findingsDir, { recursive: true })

		const filename = `${data.agent}-${Date.now()}.yaml`
		writeFileSync(join(findingsDir, filename), stringifyYaml(data), "utf-8")
	})

	// Agents can check if other agents have produced relevant findings
	pi.registerTool({
		name: "findings",
		description:
			"Read findings published by other agents via the event bus. Useful for orchestrators and reviewers to see what previous agents discovered.",
		parameters: Type.Object({
			agent: Type.Optional(
				Type.String({ description: "Filter to findings from a specific agent" })
			),
			since: Type.Optional(
				Type.String({ description: "Only findings after this ISO timestamp" })
			),
		}),
		execute: async (
			_toolCallId: string,
			params: { agent?: string; since?: string },
			_signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd = _ctx.cwd ?? process.cwd()
			const findingsDir = join(cwd, ".pi", "state", "findings")

			if (!existsSync(findingsDir)) {
				return { content: [{ type: "text", text: "No findings published yet." }] }
			}

			const files = readdirSync(findingsDir)
				.filter((f: string) => f.endsWith(".yaml"))
				.sort()

			if (files.length === 0) {
				return { content: [{ type: "text", text: "No findings published yet." }] }
			}

			let findings = files.map((f: string) => {
				const content = readFileSync(join(findingsDir, f), "utf-8")
				return { file: f, ...parseYaml(content) }
			})

			if (params.agent) {
				findings = findings.filter((f: any) => f.agent === params.agent)
			}

			if (params.since) {
				const sinceTime = new Date(params.since).getTime()
				findings = findings.filter((f: any) => {
					const match = f.file.match(/-(\d+)\.yaml$/)
					return match && parseInt(match[1]) > sinceTime
				})
			}

			if (findings.length === 0) {
				return { content: [{ type: "text", text: "No matching findings." }] }
			}

			return {
				content: [{ type: "text", text: findings.map((f: any) => stringifyYaml(f)).join("\n---\n") }],
			}
		},
	})
}
