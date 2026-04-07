/**
 * orchestrator — Meta-agent coordination layer.
 *
 * Provides:
 *   - `/orchestrate` command: invoke the project orchestrator
 *   - `/phase` command: invoke the phase orchestrator for a specific phase
 *   - `/route` command: manually route a request through routing.yaml
 *   - `dispatch` tool: real sub-agent spawning with chain/team/agent execution
 *   - Event bus channels for inter-agent state passing
 *   - Progress tracking via .pi/state/progress.yaml
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { spawn, type ChildProcess } from "child_process"
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

interface ChainStep {
	agent: string
	prompt: string
}

interface AgentFrontmatter {
	name: string
	description: string
	tools: string[]
	body: string
}

interface SpawnResult {
	output: string
	toolCount: number
	elapsed: number
}

interface AgentState {
	name: string
	status: "pending" | "running" | "completed" | "failed"
	elapsed: number
	toolCount: number
	lastOutput: string
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

function ensureSessionDir(cwd: string): string {
	const dir = join(cwd, ".pi", "state", "sessions")
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
	return dir
}

// ── Agent resolution ──────────────────────────────────────────────

function resolveAgentPath(cwd: string, agentName: string): string | null {
	const searchDirs = [
		join(cwd, ".pi", "agents", "roles"),
		join(cwd, ".pi", "agents", "tasks"),
		join(cwd, ".pi", "agents", "orchestrators"),
	]
	for (const dir of searchDirs) {
		const path = join(dir, `${agentName}.md`)
		if (existsSync(path)) return path
	}
	return null
}

function parseAgentFrontmatter(cwd: string, agentName: string): AgentFrontmatter | null {
	const agentPath = resolveAgentPath(cwd, agentName)
	if (!agentPath) return null

	try {
		const raw = readFileSync(agentPath, "utf-8")
		const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
		if (!match) return { name: agentName, description: "", tools: [], body: raw }

		const fields: Record<string, string> = {}
		for (const line of match[1].split("\n")) {
			const idx = line.indexOf(":")
			if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
		}

		return {
			name: fields.name || agentName,
			description: fields.description || "",
			tools: fields.tools ? fields.tools.split(",").map((t) => t.trim()).filter(Boolean) : [],
			body: match[2],
		}
	} catch {
		return null
	}
}

function buildPrompt(template: string, vars: { $ORIGINAL: string; $INPUT: string }): string {
	return template.replace(/\$ORIGINAL/g, vars.$ORIGINAL).replace(/\$INPUT/g, vars.$INPUT)
}

// ── Sub-agent spawning ────────────────────────────────────────────

function spawnAgent(opts: {
	cwd: string
	agentName: string
	prompt: string
	tools?: string[]
	sessionDir: string
	signal?: AbortSignal
	onUpdate?: (state: AgentState) => void
}): Promise<SpawnResult> {
	return new Promise((resolve, reject) => {
		const sessionFile = join(opts.sessionDir, `${opts.agentName}-${Date.now()}.json`)
		const args = ["--mode", "json", "-p", "--session", sessionFile, "--no-extensions"]

		if (opts.tools && opts.tools.length > 0) {
			args.push("--tools", opts.tools.join(","))
		}

		// Load agent system prompt if available
		const frontmatter = parseAgentFrontmatter(opts.cwd, opts.agentName)
		if (frontmatter?.body) {
			args.push("--append-system-prompt", frontmatter.body)
		}

		args.push(opts.prompt)

		const start = Date.now()
		let output = ""
		let toolCount = 0
		let buffer = ""

		const child = spawn("pi", args, {
			cwd: opts.cwd,
			env: { ...process.env },
			stdio: ["ignore", "pipe", "pipe"],
		})

		// Handle abort signal
		if (opts.signal) {
			const onAbort = () => {
				child.kill("SIGTERM")
				reject(new Error("Dispatch aborted"))
			}
			opts.signal.addEventListener("abort", onAbort, { once: true })
			child.on("exit", () => opts.signal?.removeEventListener("abort", onAbort))
		}

		child.stdout.on("data", (chunk: Buffer) => {
			buffer += chunk.toString()
			const lines = buffer.split("\n")
			buffer = lines.pop() || ""

			for (const line of lines) {
				if (!line.trim()) continue
				try {
					const event = JSON.parse(line)

					if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
						output += event.assistantMessageEvent.delta
					}

					if (event.type === "tool_execution_start") {
						toolCount++
					}

					if (opts.onUpdate) {
						opts.onUpdate({
							name: opts.agentName,
							status: "running",
							elapsed: Date.now() - start,
							toolCount,
							lastOutput: output.slice(-200),
						})
					}
				} catch {
					// skip non-JSON lines
				}
			}
		})

		let stderr = ""
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString()
		})

		child.on("error", (err) => {
			reject(new Error(`Failed to spawn agent "${opts.agentName}": ${err.message}`))
		})

		child.on("exit", (code) => {
			// Process remaining buffer
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer)
					if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
						output += event.assistantMessageEvent.delta
					}
				} catch {
					// ignore
				}
			}

			const elapsed = Date.now() - start

			if (code !== 0 && !output) {
				reject(new Error(`Agent "${opts.agentName}" exited with code ${code}: ${stderr.slice(-500)}`))
			} else {
				resolve({ output: output.trim(), toolCount, elapsed })
			}
		})
	})
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Tool: dispatch ─────────────────────────────────────────────
	// Spawns real sub-agents to execute chains/teams/individual agents

	pi.registerTool({
		name: "dispatch",
		label: "Dispatch",
		description:
			"Dispatch work to an agent chain, team, or individual agent. Spawns real sub-agent processes. For chains, steps execute sequentially with output passing as $INPUT. For teams, all agents run in parallel. Returns the final output.",
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
			signal: AbortSignal,
			_onUpdate: any,
			_ctx: any
		) => {
			const cwd = _ctx.cwd ?? process.cwd()
			const sessionDir = ensureSessionDir(cwd)

			// ── Chain execution ──────────────────────────────────────
			if (params.type === "chain") {
				const chainsPath = join(cwd, ".pi", "agents", "chains.yaml")
				if (!existsSync(chainsPath)) {
					return { content: [{ type: "text", text: "Error: chains.yaml not found" }] }
				}

				const chainsRaw = readFileSync(chainsPath, "utf-8")
				const chains = parseYaml(chainsRaw) as Record<string, ChainStep[]>
				const chain = chains[params.target]
				if (!chain) {
					return {
						content: [{ type: "text", text: `Error: chain "${params.target}" not found. Available: ${Object.keys(chains).join(", ")}` }],
					}
				}

				pi.events.emit("dispatch:chain-start", { chain: params.target, stepCount: chain.length })

				let currentInput = params.input
				const originalInput = params.input
				const stepResults: Array<{ agent: string; output: string; elapsed: number; toolCount: number }> = []

				for (let i = 0; i < chain.length; i++) {
					const step = chain[i]
					const stepPrompt = buildPrompt(step.prompt, {
						$ORIGINAL: originalInput,
						$INPUT: currentInput,
					})

					pi.events.emit("dispatch:step-start", {
						chain: params.target,
						step: i + 1,
						totalSteps: chain.length,
						agent: step.agent,
					})

					// Resolve agent tools from frontmatter
					const frontmatter = parseAgentFrontmatter(cwd, step.agent)
					const tools = frontmatter?.tools.length ? frontmatter.tools : undefined

					try {
						const result = await spawnAgent({
							cwd,
							agentName: step.agent,
							prompt: stepPrompt,
							tools,
							sessionDir,
							signal,
							onUpdate: (state) => {
								pi.events.emit("dispatch:step-progress", {
									chain: params.target,
									step: i + 1,
									...state,
								})
							},
						})

						stepResults.push({
							agent: step.agent,
							output: result.output,
							elapsed: result.elapsed,
							toolCount: result.toolCount,
						})

						currentInput = result.output

						pi.events.emit("dispatch:step-complete", {
							chain: params.target,
							step: i + 1,
							agent: step.agent,
							elapsed: result.elapsed,
							toolCount: result.toolCount,
							outputPreview: result.output.slice(0, 200),
						})
					} catch (err: any) {
						pi.events.emit("dispatch:error", {
							chain: params.target,
							step: i + 1,
							agent: step.agent,
							error: err.message,
						})

						const totalElapsed = stepResults.reduce((sum, r) => sum + r.elapsed, 0)
						const summary = [
							`## Chain "${params.target}" — FAILED at step ${i + 1}/${chain.length}`,
							"",
							...stepResults.map((r, j) => `Step ${j + 1} (${r.agent}): completed in ${(r.elapsed / 1000).toFixed(1)}s, ${r.toolCount} tools`),
							`Step ${i + 1} (${step.agent}): FAILED — ${err.message}`,
							"",
							`Total elapsed: ${(totalElapsed / 1000).toFixed(1)}s`,
						]
						return { content: [{ type: "text", text: summary.join("\n") }] }
					}
				}

				const totalElapsed = stepResults.reduce((sum, r) => sum + r.elapsed, 0)

				pi.events.emit("dispatch:chain-complete", {
					chain: params.target,
					totalElapsed,
					stepCount: chain.length,
				})

				const summary = [
					`## Chain "${params.target}" — Completed`,
					"",
					...stepResults.map((r, i) => `Step ${i + 1} (${r.agent}): ${(r.elapsed / 1000).toFixed(1)}s, ${r.toolCount} tools`),
					"",
					`Total: ${(totalElapsed / 1000).toFixed(1)}s`,
					"",
					"---",
					"",
					"## Final Output",
					"",
					currentInput,
				]

				return { content: [{ type: "text", text: summary.join("\n") }] }
			}

			// ── Team execution (parallel) ────────────────────────────
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

				pi.events.emit("dispatch:team-start", { team: params.target, agents: team })

				const promises = team.map(async (agentName) => {
					const frontmatter = parseAgentFrontmatter(cwd, agentName)
					const tools = frontmatter?.tools.length ? frontmatter.tools : undefined

					pi.events.emit("dispatch:step-start", {
						team: params.target,
						agent: agentName,
					})

					try {
						const result = await spawnAgent({
							cwd,
							agentName,
							prompt: params.input,
							tools,
							sessionDir,
							signal,
						})

						pi.events.emit("dispatch:step-complete", {
							team: params.target,
							agent: agentName,
							elapsed: result.elapsed,
							toolCount: result.toolCount,
						})

						return { agent: agentName, ...result, error: null }
					} catch (err: any) {
						pi.events.emit("dispatch:error", {
							team: params.target,
							agent: agentName,
							error: err.message,
						})
						return { agent: agentName, output: "", toolCount: 0, elapsed: 0, error: err.message }
					}
				})

				const results = await Promise.all(promises)

				pi.events.emit("dispatch:team-complete", {
					team: params.target,
					agentCount: team.length,
				})

				const lines = [
					`## Team "${params.target}" — Completed`,
					"",
					...results.map((r) => {
						if (r.error) return `### ${r.agent} — FAILED\n${r.error}`
						return `### ${r.agent} (${(r.elapsed / 1000).toFixed(1)}s, ${r.toolCount} tools)\n\n${r.output}`
					}),
				]

				return { content: [{ type: "text", text: lines.join("\n\n") }] }
			}

			// ── Single agent execution ───────────────────────────────
			if (params.type === "agent") {
				const frontmatter = parseAgentFrontmatter(cwd, params.target)
				if (!frontmatter) {
					return {
						content: [{ type: "text", text: `Error: agent "${params.target}" not found in roles/, tasks/, or orchestrators/` }],
					}
				}

				const prompt = params.skill
					? `Using the ${params.skill} skill, ${params.input}`
					: params.input

				pi.events.emit("dispatch:step-start", { agent: params.target })

				try {
					const result = await spawnAgent({
						cwd,
						agentName: params.target,
						prompt,
						tools: frontmatter.tools.length ? frontmatter.tools : undefined,
						sessionDir,
						signal,
					})

					pi.events.emit("dispatch:step-complete", {
						agent: params.target,
						elapsed: result.elapsed,
						toolCount: result.toolCount,
					})

					return {
						content: [{ type: "text", text: [
							`## Agent "${params.target}" — Completed (${(result.elapsed / 1000).toFixed(1)}s, ${result.toolCount} tools)`,
							"",
							result.output,
						].join("\n") }],
					}
				} catch (err: any) {
					pi.events.emit("dispatch:error", { agent: params.target, error: err.message })
					return { content: [{ type: "text", text: `Error: agent "${params.target}" failed: ${err.message}` }] }
				}
			}

			return { content: [{ type: "text", text: `Error: unknown dispatch type "${params.type}"` }] }
		},
	})

	// ── Tool: route ────────────────────────────────────────────────

	pi.registerTool({
		name: "route",
		label: "Route",
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

	pi.registerTool({
		name: "progress",
		label: "Progress",
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
					for (const wave of state.waves) {
						for (const task of wave.tasks) {
							const taskKey = `${task.chain}:${task.docType}`
							if (taskKey === params.taskId) {
								task.status = params.status as WaveTask["status"]
								if (params.note) task.output = params.note
							}
						}
					}

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

	pi.on("agent:finding", (data: any) => {
		const cwd = process.cwd()
		const findingsDir = join(cwd, ".pi", "state", "findings")
		if (!existsSync(findingsDir)) mkdirSync(findingsDir, { recursive: true })

		const filename = `${data.agent}-${Date.now()}.yaml`
		writeFileSync(join(findingsDir, filename), stringifyYaml(data), "utf-8")
	})

	// ── Tool: findings ────────────────────────────────────────────

	pi.registerTool({
		name: "findings",
		label: "Findings",
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
