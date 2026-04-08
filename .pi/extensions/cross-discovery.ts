/**
 * cross-discovery — Discovers agent definitions from .claude/, .gemini/, .codex/ directories.
 *
 * Provides:
 *   - `list_agents` tool: list all discovered agents, optionally filtered by source
 *   - `/agents` command: shorthand to list agents
 *   - `session_start` hook: emits agents:discovered event and notifies with counts
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

// ── Types ───────────────────────────────────────────────────────────

interface DiscoveredAgent {
  name: string
  description: string
  tools: string[]
  body: string
  source: string
  filePath: string
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { fields: {}, body: raw }
  const fields: Record<string, string> = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { fields, body: match[2] }
}

function expandArgs(template: string, args: string): string {
  const parts = args.split(/\s+/).filter(Boolean)
  let result = template
  result = result.replace(/\$ARGUMENTS|\$@/g, args)
  for (let i = 0; i < parts.length; i++) {
    result = result.replaceAll(`$${i + 1}`, parts[i])
  }
  return result
}

function scanDir(dir: string, source: string): DiscoveredAgent[] {
  if (!existsSync(dir)) return []
  const agents: DiscoveredAgent[] = []
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"))
  } catch {
    return []
  }
  for (const file of files) {
    const filePath = join(dir, file)
    try {
      const raw = readFileSync(filePath, "utf-8")
      const { fields, body } = parseFrontmatter(raw)
      const name = fields.name || file.replace(/\.md$/, "")
      const tools = fields.tools
        ? fields.tools
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : []
      agents.push({
        name,
        description: fields.description || "",
        tools,
        body,
        source,
        filePath,
      })
    } catch {
      // skip unreadable files
    }
  }
  return agents
}

// ── Discovery (module-level, synchronous at load time) ──────────────

const cwd = process.cwd()
const home = homedir()

// Scan order: project-local, global, built-in
// Deduplication: project-local > global > built-in (first seen wins)
const scanTargets: Array<{ dir: string; source: string }> = [
  // Project-local
  { dir: join(cwd, ".claude", "agents"), source: ".claude" },
  { dir: join(cwd, ".gemini", "agents"), source: ".gemini" },
  { dir: join(cwd, ".codex", "agents"), source: ".codex" },
  // Global
  { dir: join(home, ".claude", "agents"), source: "~/.claude" },
  { dir: join(home, ".gemini", "agents"), source: "~/.gemini" },
  { dir: join(home, ".codex", "agents"), source: "~/.codex" },
  // Built-in pi
  { dir: join(cwd, ".pi", "agents", "roles"), source: ".pi/roles" },
  { dir: join(cwd, ".pi", "agents", "tasks"), source: ".pi/tasks" },
  { dir: join(cwd, ".pi", "agents", "orchestrators"), source: ".pi/orchestrators" },
]

const seenNames = new Set<string>()
const discoveredAgents: DiscoveredAgent[] = []

for (const { dir, source } of scanTargets) {
  for (const agent of scanDir(dir, source)) {
    if (!seenNames.has(agent.name)) {
      seenNames.add(agent.name)
      discoveredAgents.push(agent)
    }
  }
}

// ── Source normalization for filtering ──────────────────────────────

function matchesSourceFilter(agentSource: string, filter: string): boolean {
  switch (filter) {
    case "all":
      return true
    case "pi":
      return agentSource.startsWith(".pi/")
    case "claude":
      return agentSource === ".claude" || agentSource === "~/.claude"
    case "gemini":
      return agentSource === ".gemini" || agentSource === "~/.gemini"
    case "codex":
      return agentSource === ".codex" || agentSource === "~/.codex"
    default:
      return true
  }
}

// ── Markdown table builder ───────────────────────────────────────────

function buildTable(agents: DiscoveredAgent[]): string {
  if (agents.length === 0) return "_No agents found._"

  const rows = agents.map((a) => {
    const toolsCell = a.tools.length > 0 ? a.tools.join(", ") : "—"
    const descCell = a.description || "—"
    return `| ${a.name} | ${descCell} | ${a.source} | ${toolsCell} |`
  })

  return [
    "| Name | Description | Source | Tools |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n")
}

// ── Extension entry point ────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── Tool: list_agents ──────────────────────────────────────────

  pi.registerTool({
    name: "list_agents",
    label: "List Agents",
    description:
      "List all discovered agent definitions from .claude/, .gemini/, .codex/ directories and .pi/agents/. Optionally filter by source.",
    parameters: Type.Object({
      source: Type.Optional(
        Type.String({
          description: 'Filter agents by source system: "pi", "claude", "gemini", "codex", or "all" (default: "all")',
          enum: ["pi", "claude", "gemini", "codex", "all"],
        })
      ),
    }),
    execute: async (
      _toolCallId: string,
      params: { source?: string },
      _signal: AbortSignal,
      _onUpdate: any,
      _ctx: any
    ) => {
      const filter = params.source || "all"
      const filtered = discoveredAgents.filter((a) => matchesSourceFilter(a.source, filter))
      const header =
        filter === "all"
          ? `## Discovered Agents (${filtered.length} total)\n`
          : `## Discovered Agents — source: ${filter} (${filtered.length} found)\n`

      return {
        content: [{ type: "text", text: header + "\n" + buildTable(filtered) }],
      }
    },
  })

  // ── Hook: session_start ────────────────────────────────────────

  pi.on("session_start", async (_event: any, ctx: any) => {
    pi.events.emit("agents:discovered", { agents: discoveredAgents })

    if (discoveredAgents.length === 0) {
      ctx.ui.notify("cross-discovery: no agents found across .claude/, .gemini/, .codex/, .pi/agents/", "info")
      return
    }

    // Build count by source category
    const counts: Record<string, number> = {}
    for (const agent of discoveredAgents) {
      const category = agent.source.startsWith(".pi/")
        ? "pi"
        : agent.source.replace(/^~\//, "")
      counts[category] = (counts[category] || 0) + 1
    }

    const summary = Object.entries(counts)
      .map(([src, n]) => `${n} from ${src}`)
      .join(", ")

    ctx.ui.notify(
      `cross-discovery: ${discoveredAgents.length} agents loaded — ${summary}`,
      "info"
    )
  })

  // ── Command: /agents ───────────────────────────────────────────

  pi.registerCommand("agents", {
    description:
      "List all discovered agents. Usage: /agents [source] — source is one of: pi, claude, gemini, codex, all (default: all).",
    handler: async (args: string, _ctx: any) => {
      const source = args.trim() || "all"
      const validSources = ["pi", "claude", "gemini", "codex", "all"]
      if (!validSources.includes(source)) {
        pi.sendUserMessage(
          `Unknown source "${source}". Valid options: ${validSources.join(", ")}`
        )
        return
      }
      pi.sendUserMessage(
        `Use the \`list_agents\` tool with source="${source}" to show all discovered agents.`
      )
    },
  })
}
