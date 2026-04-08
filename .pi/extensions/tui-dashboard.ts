/**
 * tui-dashboard — TUI visual surfaces for the Legal AI Platform.
 *
 * Provides:
 *   - Footer: real-time context meter, token counts, cost, role, phase, git branch, tool counts
 *   - Dispatch progress widget: live chain/team step tracking
 *   - Notifications: chain/team/sprint completion alerts
 *   - `/gates` command: gate readiness dashboard across phases
 *   - `/board` command: sprint kanban board
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui"

// ── Module-level state ─────────────────────────────────────────────

let toolCounts: Record<string, number> = {}
let tokensIn = 0
let tokensOut = 0
let cost = 0
let activeRole: string | null = null
let currentPhase: string | null = null
let dispatchState: {
  type: "chain" | "team"
  name: string
  steps: Array<{
    agent: string
    status: "pending" | "running" | "done" | "failed"
    elapsed: number
    toolCount: number
  }>
} | null = null

// Reference to the session context so event handlers can update widgets
let widgetCtx: any = null

// ── Footer setup ───────────────────────────────────────────────────

function setupFooter(ctx: any) {
  ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
    let cachedLines: string[] | undefined
    let cachedWidth: number | undefined

    const branchDispose = footerData.onBranchChange(() => {
      cachedLines = undefined
      tui.requestRender()
    })

    return {
      dispose() {
        branchDispose()
      },

      invalidate() {
        cachedLines = undefined
      },

      render(width: number): string[] {
        if (cachedLines && cachedWidth === width) return cachedLines
        cachedWidth = width

        // ── Context meter ──────────────────────────────────────────
        const usage = ctx.getContextUsage?.()
        let ctxMeter = ""
        if (usage) {
          const pct = Math.round((usage.used / usage.total) * 100)
          const barLen = 15
          const filled = Math.round((barLen * pct) / 100)
          const bar = "█".repeat(filled) + "░".repeat(barLen - filled)
          const color = pct > 80 ? "warning" : pct > 60 ? "accent" : "success"
          ctxMeter =
            theme.fg("dim", "ctx ") +
            theme.fg(color, `[${bar}]`) +
            theme.fg("dim", ` ${pct}%`)
        }

        // ── Token stats ────────────────────────────────────────────
        const fmt = (n: number) =>
          n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n)
        const tokenStr =
          theme.fg("success", fmt(tokensIn) + "↓") +
          " " +
          theme.fg("accent", fmt(tokensOut) + "↑")
        const costStr =
          cost > 0 ? theme.fg("warning", " $" + cost.toFixed(4)) : ""

        // ── Line 1 ─────────────────────────────────────────────────
        const line1Left = ctxMeter
        const line1Right = tokenStr + costStr
        const line1Gap = Math.max(
          1,
          width - visibleWidth(line1Left) - visibleWidth(line1Right)
        )
        const line1 = line1Left + " ".repeat(line1Gap) + line1Right

        // ── Role + phase ───────────────────────────────────────────
        const roleStr = activeRole
          ? theme.fg("accent", activeRole)
          : theme.fg("dim", "no role")
        const phaseStr = currentPhase
          ? theme.fg("accent", " ph:" + currentPhase)
          : ""

        // ── Git branch ─────────────────────────────────────────────
        const branch = footerData.getGitBranch?.() ?? ""
        const branchStr = branch ? theme.fg("muted", branch) : ""

        // ── Top 5 tool counts ──────────────────────────────────────
        const topTools = Object.entries(toolCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(
            ([name, count]) =>
              theme.fg("dim", name) + theme.fg("muted", ":" + count)
          )
          .join(" ")

        // ── Line 2 ─────────────────────────────────────────────────
        const line2Left = roleStr + phaseStr
        const line2Right = (topTools ? topTools + "  " : "") + branchStr
        const line2Gap = Math.max(
          1,
          width - visibleWidth(line2Left) - visibleWidth(line2Right)
        )
        const line2 = line2Left + " ".repeat(line2Gap) + line2Right

        cachedLines = [
          truncateToWidth(line1, width),
          truncateToWidth(line2, width),
        ]
        return cachedLines
      },
    }
  })
}

// ── Dispatch progress widget ───────────────────────────────────────

function refreshDispatchWidget() {
  if (!dispatchState || !widgetCtx?.hasUI) return

  const icons: Record<string, string> = {
    pending: "○",
    running: "●",
    done: "✓",
    failed: "✗",
  }

  const lines: string[] = []
  lines.push(`─ Dispatch: ${dispatchState.name} ──`)

  for (const step of dispatchState.steps) {
    const icon = icons[step.status] ?? "?"
    const elapsed =
      step.elapsed > 0 ? ` ${(step.elapsed / 1000).toFixed(1)}s` : ""
    const tools = step.toolCount > 0 ? ` tools:${step.toolCount}` : ""
    lines.push(`  ${icon} ${step.agent}${elapsed}${tools}`)
  }

  widgetCtx.ui.setWidget("dispatch-progress", lines)
}

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── session_start: reset state, wire footer ──────────────────────

  pi.on("session_start", async (_event: any, ctx: any) => {
    toolCounts = {}
    tokensIn = 0
    tokensOut = 0
    cost = 0

    widgetCtx = ctx

    if (!ctx.hasUI) return

    setupFooter(ctx)
  })

  // ── Tool usage counting ──────────────────────────────────────────

  pi.on("tool_execution_end", async (event: any, _ctx: any) => {
    const name = event.toolName ?? event.name ?? "unknown"
    toolCounts[name] = (toolCounts[name] ?? 0) + 1
  })

  // ── Role change listener ─────────────────────────────────────────

  pi.events.on("role:changed", (data: any) => {
    activeRole = data?.role ?? null
  })

  // ── Phase change listener ────────────────────────────────────────

  pi.events.on("phase:changed", (data: any) => {
    currentPhase = data?.phase ?? null
  })

  // ── Dispatch chain events ────────────────────────────────────────

  pi.events.on("dispatch:chain-start", (data: any) => {
    dispatchState = {
      type: "chain",
      name: data.chain,
      steps: Array.from({ length: data.stepCount }, () => ({
        agent: "...",
        status: "pending" as const,
        elapsed: 0,
        toolCount: 0,
      })),
    }
    refreshDispatchWidget()
  })

  pi.events.on("dispatch:step-start", (data: any) => {
    if (!dispatchState) return
    const idx = (data.step ?? 1) - 1
    if (dispatchState.steps[idx]) {
      dispatchState.steps[idx].agent = data.agent
      dispatchState.steps[idx].status = "running"
    }
    refreshDispatchWidget()
  })

  pi.events.on("dispatch:step-complete", (data: any) => {
    if (!dispatchState) return
    const idx = (data.step ?? 1) - 1
    if (dispatchState.steps[idx]) {
      dispatchState.steps[idx].status = "done"
      dispatchState.steps[idx].elapsed = data.elapsed ?? 0
      dispatchState.steps[idx].toolCount = data.toolCount ?? 0
    }
    refreshDispatchWidget()
  })

  pi.events.on("dispatch:error", (data: any) => {
    if (!dispatchState) return
    const idx = (data.step ?? 1) - 1
    if (dispatchState.steps[idx]) {
      dispatchState.steps[idx].status = "failed"
    }
    refreshDispatchWidget()
  })

  pi.events.on("dispatch:chain-complete", (data: any) => {
    // Notification
    if (widgetCtx?.hasUI) {
      const elapsed =
        data.totalElapsed
          ? ` in ${(data.totalElapsed / 1000).toFixed(1)}s`
          : ""
      widgetCtx.ui.notify(`Chain "${data.chain}" completed${elapsed}`, "info")
    }

    // Clear widget after short delay
    setTimeout(() => {
      dispatchState = null
      widgetCtx?.ui.setWidget("dispatch-progress", undefined)
    }, 3000)
  })

  pi.events.on("dispatch:team-complete", (data: any) => {
    // Notification
    if (widgetCtx?.hasUI) {
      widgetCtx.ui.notify(`Team "${data.team}" completed`, "info")
    }

    // Clear widget after short delay
    setTimeout(() => {
      dispatchState = null
      widgetCtx?.ui.setWidget("dispatch-progress", undefined)
    }, 3000)
  })

  // ── Sprint notifications ─────────────────────────────────────────

  pi.events.on("sprint:item-complete", (data: any) => {
    if (widgetCtx?.hasUI) {
      widgetCtx.ui.notify(`Sprint item ${data.id} completed`, "info")
    }
  })

  // ── /gates command ───────────────────────────────────────────────

  pi.registerCommand("gates", {
    description:
      "Show gate readiness dashboard for all phases. Usage: /gates [phase]",
    handler: async (args: string, _ctx: any) => {
      const phase = args.trim()
      if (phase) {
        pi.sendUserMessage(
          `Use the doc_gate_check tool with phase="${phase}" to show gate readiness, then use doc_status with phase="${phase}" to show document inventory.`
        )
      } else {
        pi.sendUserMessage(
          "Use the doc_gate_check tool for phases 0, 1, 2, 3, 4, and 5 to produce a comprehensive gate readiness report across all phases. Present results as a matrix table."
        )
      }
    },
  })

  // ── /board command ───────────────────────────────────────────────

  pi.registerCommand("board", {
    description: "Show sprint board. Usage: /board",
    handler: async (_args: string, _ctx: any) => {
      pi.sendUserMessage(
        "Use the sprint_status tool to get the current sprint state, then present the backlog as a kanban board grouped by status (Todo | In Progress | Review | Done) and sorted by priority."
      )
    },
  })
}
