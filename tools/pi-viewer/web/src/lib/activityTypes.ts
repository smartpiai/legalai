/** TypeScript mirror of the server's ActivityEvent shape. */

export type ActivityKind =
  | "chain_start"
  | "step_start"
  | "step_done"
  | "step_error"
  | "chain_done"
  | "agent_session"
  | "task_transition";

export type ActivityEvent = {
  kind: ActivityKind;
  at: string; // ISO-8601

  // -- chain-level (Layer A) --
  chain_id?: string;
  chain?: string;
  task?: string;
  steps?: string[];
  success?: boolean;

  // -- step-level --
  step?: number;
  agent?: string;
  promptPreview?: string;
  outputPreview?: string;
  error?: string;
  elapsedMs?: number;

  // -- agent_session (Layer B) --
  sessionFile?: string;
  start?: string;
  end?: string;
  firstUserText?: string;
  lastAssistantText?: string;
  toolCallCount?: number;
  lastToolName?: string;
  source?: "inferred";

  // -- task_transition --
  sprintId?: number;
  sprintFile?: string;
  taskId?: string;
  title?: string;
  from?: string | null;
  to?: string;
  assignee?: string;
};
