/**
 * safety-enforcer — Runtime safety rule enforcement for pi-coding-agent.
 *
 * Reads `.pi/safety-rules.yaml` and enforces four categories of protection:
 *
 *   1. bashToolPatterns  — Dangerous shell command patterns (block or ask).
 *   2. zeroAccessPaths   — Paths the agent must never read OR write.
 *   3. readOnlyPaths     — Paths the agent may read but must never modify.
 *   4. noDeletePaths     — Paths that must never be deleted via bash rm.
 *
 * All violations are logged via pi.appendEntry("safety-log", ...).
 *
 * Hooks registered:
 *   - session_start : reload rules from disk, notify with rule counts.
 *   - tool_call     : check every tool call against all active rules.
 *
 * Tools registered:
 *   - safety_status : returns a formatted summary of active rules.
 *
 * Commands registered:
 *   - /safety-reload : reloads rules from disk on demand.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { parse } from "yaml"

// ── Types ──────────────────────────────────────────────────────────────────

interface BashPattern {
  pattern: string
  reason: string
  ask: boolean
}

interface SafetyRules {
  bashToolPatterns: BashPattern[]
  zeroAccessPaths: string[]
  readOnlyPaths: string[]
  noDeletePaths: string[]
}

interface ViolationRecord {
  timestamp: string
  toolName: string
  rule: string
  detail: string
  filePath?: string
  command?: string
  blocked: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const RULES_RELATIVE_PATH = ".pi/safety-rules.yaml"

/** Tool names that perform write / modify operations. */
const WRITE_TOOL_NAMES = new Set([
  "write",
  "edit",
  "create",
  "overwrite",
  "patch",
  "str_replace_editor",
  "str_replace_based_edit_tool",
])

/** Tool names that perform delete operations (file-level). */
const DELETE_TOOL_NAMES = new Set(["delete", "remove", "unlink"])

/** Tool names that perform any file access (read + write). */
const READ_TOOL_NAMES = new Set([
  "read",
  "open",
  "cat",
  "view",
  "ls",
  "list",
  "glob",
  "grep",
  "find",
  "search",
])

// All file-touching tool names for zero-access checks.
const FILE_TOOL_NAMES = new Set([...WRITE_TOOL_NAMES, ...READ_TOOL_NAMES, ...DELETE_TOOL_NAMES])

// ── Glob matcher ───────────────────────────────────────────────────────────

/**
 * Convert a single glob pattern (without `!` prefix) to a RegExp.
 * Supports:
 *   `~`        → os.homedir()
 *   `**`       → matches any directory depth (including zero)
 *   `*`        → matches any characters within a single path segment
 *   `?`        → matches any single character
 *   Literal `.` characters are escaped.
 */
function globToRegex(glob: string): RegExp {
  // Resolve home directory shorthand.
  const expanded = glob.startsWith("~") ? glob.replace("~", homedir()) : glob

  // Build regex token by token to handle ** vs * correctly.
  let regex = ""
  let i = 0
  while (i < expanded.length) {
    const ch = expanded[i]

    if (ch === "*" && expanded[i + 1] === "*") {
      // `**` — match anything (including slashes and empty string).
      regex += ".*"
      i += 2
      // Consume a trailing slash if present so `**/foo` doesn't double-slash.
      if (expanded[i] === "/") i++
    } else if (ch === "*") {
      // Single `*` — match any characters except `/`.
      regex += "[^/]*"
      i++
    } else if (ch === "?") {
      regex += "."
      i++
    } else if (".+^${}()|[]\\".includes(ch)) {
      // Escape regex-special characters.
      regex += "\\" + ch
      i++
    } else {
      regex += ch
      i++
    }
  }

  // Anchor to full string.
  return new RegExp("^" + regex + "$")
}

/**
 * Test whether `filePath` matches any of the provided glob `patterns`.
 *
 * Processing rules:
 *   - Patterns are evaluated in order.
 *   - Start with `matched = false`.
 *   - A pattern beginning with `!` is a negation: if the remainder matches,
 *     set `matched = false`.
 *   - Otherwise, if the pattern matches, set `matched = true`.
 *   - Return the final value of `matched`.
 *
 * This allows whitelist overrides such as:
 *   **\/.env.* (block)  followed by  !**\/.env.example (allow)
 */
function isPathMatch(filePath: string, patterns: string[]): boolean {
  // Normalise backslashes and resolve home shorthand in the subject path.
  const normalised = filePath.replace(/\\/g, "/")

  let matched = false
  for (const raw of patterns) {
    if (raw.startsWith("!")) {
      const inner = raw.slice(1)
      if (globToRegex(inner).test(normalised)) {
        matched = false
      }
    } else {
      if (globToRegex(raw).test(normalised)) {
        matched = true
      }
    }
  }
  return matched
}

// ── Path extraction ────────────────────────────────────────────────────────

/**
 * Extract all file paths referenced by a tool call's input object.
 *
 * Handles:
 *   - read / write / edit / create tools  → `file_path` or `path`
 *   - grep / find / ls tools              → `path`
 *   - bash tool                           → heuristic extraction from `command`
 */
function extractPaths(toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object") return []

  const inp = input as Record<string, unknown>
  const paths: string[] = []

  // Standard single-path tools.
  if (FILE_TOOL_NAMES.has(toolName)) {
    for (const key of ["file_path", "path", "filepath", "filename"]) {
      if (typeof inp[key] === "string" && inp[key]) {
        paths.push(inp[key] as string)
      }
    }
  }

  // Bash: extract paths heuristically from the command string.
  if (toolName === "bash" && typeof inp["command"] === "string") {
    paths.push(...extractPathsFromCommand(inp["command"] as string))
  }

  return [...new Set(paths)]
}

/**
 * Extract file paths from a bash command string using common patterns:
 *   - Arguments immediately following rm, cat, cp, mv, chmod, touch, nano, vi, etc.
 *   - Redirect targets after `>` and `>>`.
 *   - Arguments to common read tools: less, head, tail, wc, file, stat.
 */
function extractPathsFromCommand(command: string): string[] {
  const results: string[] = []

  // Split by shell separators to handle chained commands.
  const subCommands = command.split(/[;&|]+/)

  for (const sub of subCommands) {
    const trimmed = sub.trim()

    // Capture path-like tokens after well-known commands.
    const cmdMatch = trimmed.match(
      /^\s*(?:sudo\s+)?(?:rm|cat|cp|mv|chmod|chown|touch|nano|vi|vim|less|head|tail|wc|file|stat|ln|open|code|diff)\s+(.*)/i
    )
    if (cmdMatch) {
      const argsPart = cmdMatch[1]
      // Parse tokens, skip flags (starting with -).
      const tokens = tokeniseShellArgs(argsPart)
      for (const t of tokens) {
        if (!t.startsWith("-") && looksLikePath(t)) {
          results.push(t)
        }
      }
    }

    // Redirect targets.
    const redirectMatches = trimmed.matchAll(/(?:>>?)\s*([^\s;|&]+)/g)
    for (const m of redirectMatches) {
      if (looksLikePath(m[1])) results.push(m[1])
    }
  }

  return results
}

/**
 * Naively split a shell argument string into tokens,
 * handling single- and double-quoted strings.
 */
function tokeniseShellArgs(args: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += ch
    }
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

/** Heuristic: does a string look like it could be a file path? */
function looksLikePath(s: string): boolean {
  return s.includes("/") || s.includes(".") || s.startsWith("~")
}

// ── Rules loader ───────────────────────────────────────────────────────────

/**
 * Locate the project root by searching upward from `startDir` for the
 * `.pi/safety-rules.yaml` file.  Falls back to `startDir` itself.
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, RULES_RELATIVE_PATH))) return dir
    const parent = join(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  return startDir
}

/**
 * Load and parse the safety rules file.  Returns a default (empty) rule set
 * if the file does not exist or cannot be parsed.
 */
function loadRules(cwd: string): SafetyRules {
  const root = findProjectRoot(cwd)
  const rulesPath = join(root, RULES_RELATIVE_PATH)

  const defaults: SafetyRules = {
    bashToolPatterns: [],
    zeroAccessPaths: [],
    readOnlyPaths: [],
    noDeletePaths: [],
  }

  if (!existsSync(rulesPath)) {
    console.warn(`[safety-enforcer] Rules file not found at ${rulesPath}`)
    return defaults
  }

  try {
    const raw = readFileSync(rulesPath, "utf8")
    const parsed = parse(raw) as Partial<SafetyRules>
    return {
      bashToolPatterns: Array.isArray(parsed.bashToolPatterns) ? parsed.bashToolPatterns : [],
      zeroAccessPaths: Array.isArray(parsed.zeroAccessPaths) ? parsed.zeroAccessPaths : [],
      readOnlyPaths: Array.isArray(parsed.readOnlyPaths) ? parsed.readOnlyPaths : [],
      noDeletePaths: Array.isArray(parsed.noDeletePaths) ? parsed.noDeletePaths : [],
    }
  } catch (err) {
    console.error(`[safety-enforcer] Failed to parse rules file: ${err}`)
    return defaults
  }
}

// ── Formatted summary ──────────────────────────────────────────────────────

function formatRulesSummary(rules: SafetyRules, rulesPath: string): string {
  const lines: string[] = [
    "Safety Enforcer — Active Rules",
    "================================",
    `Rules file: ${rulesPath}`,
    "",
    `Bash patterns       : ${rules.bashToolPatterns.length}`,
    `Zero-access paths   : ${rules.zeroAccessPaths.length} (includes ${rules.zeroAccessPaths.filter((p) => p.startsWith("!")).length} whitelist entries)`,
    `Read-only paths     : ${rules.readOnlyPaths.length}`,
    `No-delete paths     : ${rules.noDeletePaths.length}`,
    "",
  ]

  if (rules.bashToolPatterns.length > 0) {
    lines.push("Bash Patterns:")
    for (const bp of rules.bashToolPatterns) {
      lines.push(`  [${bp.ask ? "ASK" : "BLOCK"}] /${bp.pattern}/ — ${bp.reason}`)
    }
    lines.push("")
  }

  if (rules.zeroAccessPaths.length > 0) {
    lines.push("Zero-Access Paths:")
    for (const p of rules.zeroAccessPaths) {
      lines.push(`  ${p}`)
    }
    lines.push("")
  }

  if (rules.readOnlyPaths.length > 0) {
    lines.push("Read-Only Paths:")
    for (const p of rules.readOnlyPaths) {
      lines.push(`  ${p}`)
    }
    lines.push("")
  }

  if (rules.noDeletePaths.length > 0) {
    lines.push("No-Delete Paths:")
    for (const p of rules.noDeletePaths) {
      lines.push(`  ${p}`)
    }
  }

  return lines.join("\n")
}

// ── Extension entry point ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Mutable rules state — reloaded on session_start and /safety-reload.
  let rules: SafetyRules = {
    bashToolPatterns: [],
    zeroAccessPaths: [],
    readOnlyPaths: [],
    noDeletePaths: [],
  }
  let rulesFilePath = "(not loaded)"

  /** Reload rules from disk and return a short summary string. */
  function reloadRules(cwd: string): string {
    rules = loadRules(cwd)
    const root = findProjectRoot(cwd)
    rulesFilePath = join(root, RULES_RELATIVE_PATH)

    const total =
      rules.bashToolPatterns.length +
      rules.zeroAccessPaths.length +
      rules.readOnlyPaths.length +
      rules.noDeletePaths.length

    return (
      `Safety rules loaded: ` +
      `${rules.bashToolPatterns.length} bash patterns, ` +
      `${rules.zeroAccessPaths.length} zero-access paths, ` +
      `${rules.readOnlyPaths.length} read-only paths, ` +
      `${rules.noDeletePaths.length} no-delete paths ` +
      `(${total} total)`
    )
  }

  /** Append a violation record to the audit log. */
  function logViolation(record: ViolationRecord): void {
    try {
      pi.appendEntry("safety-log", record)
    } catch {
      // Logging must never throw — silently swallow errors.
    }
  }

  // ── Hook: session_start ─────────────────────────────────────────────────

  pi.on("session_start", async (_event: unknown, ctx: any) => {
    const cwd = ctx?.cwd ?? process.cwd()
    const summary = reloadRules(cwd)
    try {
      ctx.ui.notify(summary, "info")
    } catch {
      // UI not available in all contexts.
    }
  })

  // ── Hook: tool_call ─────────────────────────────────────────────────────

  pi.on("tool_call", async (event: any, ctx: any) => {
    const toolName: string = (event.toolName ?? event.name ?? "").toLowerCase()
    const input: unknown = event.input ?? {}
    const cwd: string = ctx?.cwd ?? process.cwd()

    // Ensure rules are loaded if session_start was not fired (e.g. in tests).
    if (
      rules.bashToolPatterns.length === 0 &&
      rules.zeroAccessPaths.length === 0 &&
      rules.readOnlyPaths.length === 0 &&
      rules.noDeletePaths.length === 0
    ) {
      reloadRules(cwd)
    }

    const inp = (input ?? {}) as Record<string, unknown>

    // ── 1. Bash pattern checks ────────────────────────────────────────────

    if (toolName === "bash" && typeof inp["command"] === "string") {
      const command = inp["command"] as string

      for (const bp of rules.bashToolPatterns) {
        let regex: RegExp
        try {
          regex = new RegExp(bp.pattern, "i")
        } catch {
          // Malformed pattern in rules — skip it.
          continue
        }

        if (!regex.test(command)) continue

        if (bp.ask) {
          // Ask the user whether to proceed.
          let confirmed = false
          try {
            confirmed = await ctx.ui.confirm(
              "Potentially Dangerous Command",
              `The following command matches a safety rule:\n\n` +
                `  Command : ${command}\n` +
                `  Pattern : ${bp.pattern}\n` +
                `  Reason  : ${bp.reason}\n\n` +
                `Do you want to allow this command to run?`,
              { timeout: 30000 }
            )
          } catch {
            // If UI call throws (e.g. timeout), treat as declined.
            confirmed = false
          }

          if (!confirmed) {
            logViolation({
              timestamp: new Date().toISOString(),
              toolName,
              rule: "bashToolPatterns",
              detail: `Pattern /${bp.pattern}/ matched — user declined`,
              command,
              blocked: true,
            })
            return { block: true, reason: `Blocked by safety rule: ${bp.reason}` }
          }

          // User confirmed — log and continue.
          logViolation({
            timestamp: new Date().toISOString(),
            toolName,
            rule: "bashToolPatterns",
            detail: `Pattern /${bp.pattern}/ matched — user approved`,
            command,
            blocked: false,
          })
        } else {
          // Automatic block — no confirmation.
          logViolation({
            timestamp: new Date().toISOString(),
            toolName,
            rule: "bashToolPatterns",
            detail: `Pattern /${bp.pattern}/ matched — auto-blocked`,
            command,
            blocked: true,
          })
          return { block: true, reason: `Blocked by safety rule: ${bp.reason}` }
        }
      }
    }

    // ── 2 & 3 & 4. Path-based checks ─────────────────────────────────────

    const paths = extractPaths(toolName, input)
    if (paths.length === 0) return

    for (const filePath of paths) {
      // ── 2. Zero-access paths — block ALL operations ─────────────────────

      if (rules.zeroAccessPaths.length > 0 && isPathMatch(filePath, rules.zeroAccessPaths)) {
        logViolation({
          timestamp: new Date().toISOString(),
          toolName,
          rule: "zeroAccessPaths",
          detail: `Path is zero-access: ${filePath}`,
          filePath,
          blocked: true,
        })
        return {
          block: true,
          reason: `Access denied: "${filePath}" is in a protected zero-access path.`,
        }
      }

      // ── 3. Read-only paths — block write/edit/delete operations ─────────

      if (
        rules.readOnlyPaths.length > 0 &&
        (WRITE_TOOL_NAMES.has(toolName) || DELETE_TOOL_NAMES.has(toolName)) &&
        isPathMatch(filePath, rules.readOnlyPaths)
      ) {
        logViolation({
          timestamp: new Date().toISOString(),
          toolName,
          rule: "readOnlyPaths",
          detail: `Write attempted on read-only path: ${filePath}`,
          filePath,
          blocked: true,
        })
        return {
          block: true,
          reason: `Write denied: "${filePath}" is a read-only path. Use the appropriate package manager or tooling to modify it.`,
        }
      }

      // ── 4. No-delete paths — block rm in bash and delete tool calls ──────

      const isDeleteTool = DELETE_TOOL_NAMES.has(toolName)
      const isRmInBash =
        toolName === "bash" &&
        typeof inp["command"] === "string" &&
        /\brm\b/.test(inp["command"] as string)

      if (
        rules.noDeletePaths.length > 0 &&
        (isDeleteTool || isRmInBash) &&
        isPathMatch(filePath, rules.noDeletePaths)
      ) {
        logViolation({
          timestamp: new Date().toISOString(),
          toolName,
          rule: "noDeletePaths",
          detail: `Delete attempted on protected path: ${filePath}`,
          filePath,
          blocked: true,
        })
        return {
          block: true,
          reason: `Delete denied: "${filePath}" is a protected path that must never be deleted.`,
        }
      }
    }

    // No violations — allow the tool call to proceed.
    return undefined
  })

  // ── Tool: safety_status ─────────────────────────────────────────────────

  pi.registerTool({
    name: "safety_status",
    label: "Safety Enforcer Status",
    description:
      "Returns a formatted summary of all active safety rules loaded from .pi/safety-rules.yaml, " +
      "including bash patterns, zero-access paths, read-only paths, and no-delete paths.",
    parameters: Type.Object({}),
    execute: async (_toolCallId, _params, _signal, _onUpdate, _ctx) => {
      const summary = formatRulesSummary(rules, rulesFilePath)
      return {
        content: [{ type: "text", text: summary }],
      }
    },
  })

  // ── Command: /safety-reload ─────────────────────────────────────────────

  pi.registerCommand("safety-reload", {
    description: "Reload safety rules from .pi/safety-rules.yaml without restarting the session.",
    handler: async (_args: string, ctx: any) => {
      const cwd = ctx?.cwd ?? process.cwd()
      const summary = reloadRules(cwd)
      try {
        ctx.ui.notify(summary, "info")
      } catch {
        // UI may not be available.
      }
      return summary
    },
  })
}
