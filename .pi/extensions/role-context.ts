/**
 * role-context — Role-based context injection for the Legal AI Platform.
 *
 * Provides:
 *   - `/role` command: set the active role for the session
 *   - `before_agent_start` hook: inject role-specific guidance into context
 *   - `input` hook: detect role from natural language and suggest /role
 *
 * Roles shape the agent's behavior: what language to use, what level of detail
 * to provide, and which documents the user is likely authoring or consuming.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

// ── Role definitions ───────────────────────────────────────────────

interface RoleConfig {
	name: string
	label: string
	description: string
	authorOf: string[]
	consumerOf: string[]
	guidance: string
}

const ROLES: Record<string, RoleConfig> = {
	pm: {
		name: "pm",
		label: "Product Owner / PM",
		description: "Product vision, feature prioritization, business justification",
		authorOf: ["BRD", "PRD"],
		consumerOf: ["Tech Spec (summary)", "Perf Spec (cost projections)", "Test Spec (success metrics)"],
		guidance: `You are assisting a Product Owner / PM. Adjust your communication:
- Lead with business impact, not implementation details
- Quantify everything: costs in dollars, time savings in hours, risk in probability
- When discussing technical topics, translate to stakeholder language
- Help structure BRDs with strong "Impact of Inaction" sections
- Help structure PRDs with clear acceptance criteria and measurable success metrics
- Suggest metrics that can be tracked, not vague aspirations
- When reviewing technical docs, focus on: does this solve the user problem stated in the PRD?
- Flag scope creep: if implementation diverges from PRD, surface it`,
	},
	techlead: {
		name: "techlead",
		label: "Tech Lead / Architect",
		description: "System design, code quality, technical decisions, spec approval",
		authorOf: ["ADR", "Tech Spec"],
		consumerOf: ["BRD", "PRD", "all downstream specs (review/approval)"],
		guidance: `You are assisting a Tech Lead / Architect. Adjust your communication:
- Be precise about trade-offs: every choice has a cost, name it
- Surface edge cases and failure modes proactively
- When writing ADRs, ensure the "Assumptions" section is concrete and falsifiable
- For Tech Specs, ensure the architecture diagram is accurate and the concurrency model is explicit
- Challenge vague requirements: "fast" is not a target, "p95 < 500ms" is
- When reviewing, focus on: maintainability, testability, operational burden, security surface
- Flag decisions that create irreversible lock-in
- Help identify what can be deferred vs. what must be decided now`,
	},
	engineer: {
		name: "engineer",
		label: "Engineer",
		description: "Implementation, testing, code review",
		authorOf: ["Tech Spec (component-level)", "Test Spec", "Dep Review"],
		consumerOf: ["Tech Spec", "ID Spec", "Test Spec", "ADR"],
		guidance: `You are assisting an Engineer. Adjust your communication:
- Be concrete: show code patterns, file paths, command examples
- Reference existing patterns in the codebase before introducing new ones
- When writing tests, follow the project's TDD methodology (Red-Green-Refactor)
- For Tech Specs, focus on the component you own — keep scope tight
- For Dep Reviews, be thorough on CVEs and license compatibility
- Explain the "why" behind architectural decisions when relevant
- When unsure about scope, reference the PRD acceptance criteria`,
	},
	frontend: {
		name: "frontend",
		label: "Frontend Engineer",
		description: "UI/UX implementation, client-side performance, accessibility",
		authorOf: ["Tech Spec (frontend)", "Test Spec (frontend)"],
		consumerOf: ["PRD (UI requirements)", "ID Spec (API contracts)", "Tech Spec"],
		guidance: `You are assisting a Frontend Engineer. Adjust your communication:
- Focus on React 18 + TypeScript + Tailwind patterns used in this project
- Reference the ID Spec for API contracts — the frontend consumes these
- Ensure accessibility (WCAG 2.1 AA) is addressed in every component
- For Test Specs, cover the UI State Matrix: empty, loading, error, populated, edge states
- Help with client-side performance budgets: bundle size, LCP, FCP, CLS
- When the PRD specifies UI behavior, map it directly to component requirements`,
	},
	sre: {
		name: "sre",
		label: "SRE / Platform Engineer",
		description: "Infrastructure, deployment, monitoring, incident response",
		authorOf: ["Runbook", "Mig Guide", "Perf Spec"],
		consumerOf: ["Tech Spec (ops sections)", "Sec Review", "Dep Review"],
		guidance: `You are assisting an SRE / Platform Engineer. Adjust your communication:
- Provide exact commands, not descriptions of commands
- For Runbooks, the Quick Reference Card matters most — optimize for 3am readability
- For Migration Guides, be paranoid: point of no return, rollback at every step, verification queries
- For Perf Specs, ensure baselines are measured, not assumed
- Think about failure modes: what breaks at 2x load? 10x? When the dependency is down?
- Include monitoring queries and dashboard links
- Specify alert thresholds with rationale, not arbitrary numbers
- Help design graceful degradation tiers`,
	},
	security: {
		name: "security",
		label: "Security Engineer",
		description: "Threat modeling, security audits, compliance verification",
		authorOf: ["Sec Review"],
		consumerOf: ["Tech Spec", "ID Spec", "Dep Review"],
		guidance: `You are assisting a Security Engineer. Adjust your communication:
- Think adversarially: how would an attacker exploit this?
- Use the risk scoring matrix (Likelihood x Impact) consistently
- For AI/LLM features, cover OWASP LLM Top 10 threats systematically
- Ensure every finding has: severity, risk score, specific mitigation, residual risk
- Check data flows: what crosses trust boundaries? What goes to external vendors?
- Verify tenant isolation in every feature touching data
- For Dep Reviews, focus on supply chain health, not just CVE counts
- Map findings to compliance frameworks (SOC 2 controls, GDPR articles)`,
	},
	qa: {
		name: "qa",
		label: "QA Lead",
		description: "Test strategy, coverage standards, quality gates",
		authorOf: ["Test Spec"],
		consumerOf: ["Tech Spec", "PRD (acceptance criteria)", "ID Spec"],
		guidance: `You are assisting a QA Lead. Adjust your communication:
- Structure test cases with: ID, preconditions, input, expected output, cleanup, priority
- Ensure fault injection tests are included for every external dependency
- Define the flaky test policy and quarantine process
- Set coverage targets per layer: unit, integration, E2E
- For AI features, define eval harness metrics with pass/fail thresholds
- Help design contract tests between frontend and backend
- Ensure test data lifecycle is documented: generation, versioning, PII handling
- Define CI pipeline integration: what runs on PR vs. nightly vs. release`,
	},
	dataml: {
		name: "dataml",
		label: "Data / ML Engineer",
		description: "AI model integration, eval harness, embedding pipelines",
		authorOf: ["Perf Spec (AI sections)", "Test Spec (eval harness)"],
		consumerOf: ["Tech Spec (AI sections)", "PRD (AI behavior requirements)", "Sec Review (AI security)"],
		guidance: `You are assisting a Data / ML Engineer. Adjust your communication:
- Focus on accuracy metrics: F1, precision, recall, MRR, recall@k
- Track cost per invocation and monthly projections
- For eval harnesses, define ground-truth datasets, annotation guidelines, and significance tests
- Help design confidence thresholds and fallback behavior
- Ensure hallucination detection and grounding strategies are concrete
- For embedding changes, quantify the re-indexing cost (time, compute, downtime)
- Compare model options with: accuracy, latency, cost, context window, data residency`,
	},
}

// ── State ──────────────────────────────────────────────────────────

let activeRole: RoleConfig | null = null

// ── Extension entry point ──────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// ── Command: /role ─────────────────────────────────────────────

	pi.registerCommand("role", {
		description:
			"Set your active role. Usage: /role <pm|techlead|engineer|frontend|sre|security|qa|dataml> — or /role to see current role and available options.",
		handler: async (args: string, ctx: any) => {
			const roleName = args.trim().toLowerCase()

			if (!roleName) {
				const current = activeRole ? `Current role: **${activeRole.label}**` : "No role set."
				const available = Object.entries(ROLES)
					.map(([key, r]) => `  \`${key}\` — ${r.label}`)
					.join("\n")

				pi.sendUserMessage(
					`${current}\n\nAvailable roles:\n${available}\n\nSet with: /role <name>`
				)
				return
			}

			const role = ROLES[roleName]
			if (!role) {
				const available = Object.keys(ROLES).join(", ")
				pi.sendUserMessage(
					`Unknown role "${roleName}". Available: ${available}`
				)
				return
			}

			activeRole = role
			pi.sendUserMessage(
				`Role set to **${role.label}**.\n\n` +
					`You typically author: ${role.authorOf.join(", ")}\n` +
					`You typically consume: ${role.consumerOf.join(", ")}\n\n` +
					`The agent will now tailor its responses to your role.`
			)
		},
	})

	// ── Hook: inject role context before each agent turn ───────────

	pi.on("before_agent_start", async (_event: any, ctx: any) => {
		if (!activeRole) return

		// Inject role guidance as a system-level context addition
		return {
			systemPromptAdditions: [
				`\n\n## Active Role: ${activeRole.label}\n\n${activeRole.guidance}`,
			],
		}
	})

	// ── Hook: detect role keywords in first message ────────────────

	pi.on("input", async (event: any, _ctx: any) => {
		if (activeRole) return // already set

		const text = (event.text ?? "").toLowerCase()
		const roleHints: Record<string, string[]> = {
			pm: ["brd", "business requirements", "roi", "stakeholder", "product requirements", "prd"],
			techlead: ["architecture", "adr", "tech spec", "design decision", "system design"],
			sre: ["runbook", "migration", "deploy", "monitoring", "incident", "infrastructure"],
			security: ["threat model", "security review", "cve", "vulnerability", "penetration"],
			qa: ["test spec", "coverage", "test case", "flaky test", "ci pipeline"],
			dataml: ["eval harness", "embedding", "model accuracy", "f1 score", "hallucination"],
		}

		for (const [role, hints] of Object.entries(roleHints)) {
			if (hints.some((hint) => text.includes(hint))) {
				// Don't auto-set, just suggest
				return {
					prependToInput: `[Hint: This looks like ${ROLES[role].label} work. Run \`/role ${role}\` to get role-tailored assistance.]\n\n`,
				}
			}
		}
	})
}
