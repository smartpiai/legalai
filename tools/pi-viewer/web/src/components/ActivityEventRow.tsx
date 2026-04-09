import type { ActivityEvent } from "../lib/activityTypes";
import { formatDuration, timeAgo } from "../lib/formatDuration";

function displayAgent(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const cls: Record<string, string> = {
    green: "bg-emerald-900/40 text-emerald-400",
    red: "bg-red-900/40 text-red-400",
    blue: "bg-sky-900/40 text-sky-400",
    gray: "bg-slate-800 text-slate-400",
    amber: "bg-amber-900/40 text-amber-400",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls[color] ?? cls.gray}`}>
      {children}
    </span>
  );
}

export default function ActivityEventRow({
  event,
  selected,
  onClick,
}: {
  event: ActivityEvent;
  selected: boolean;
  onClick: () => void;
}) {
  const k = event.kind;

  let icon: string;
  let borderColor: string;
  let line: React.ReactNode;

  switch (k) {
    case "chain_start":
      icon = "▶";
      borderColor = "border-sky-700";
      line = (
        <>
          <span className="text-sky-400 font-medium">{event.chain}</span>
          <span className="text-slate-500 mx-1">—</span>
          <span className="text-slate-400 truncate">{event.task}</span>
          {event.steps && (
            <Badge color="gray">{event.steps.length} steps</Badge>
          )}
        </>
      );
      break;

    case "step_start":
      icon = "●";
      borderColor = "border-slate-700";
      line = (
        <>
          <span className="text-slate-400">{displayAgent(event.agent ?? "?")}</span>
          <span className="text-slate-600 ml-1">started</span>
        </>
      );
      break;

    case "step_done":
      icon = "✓";
      borderColor = "border-emerald-800";
      line = (
        <>
          <span className="text-emerald-400">{displayAgent(event.agent ?? "?")}</span>
          <Badge color="green">{formatDuration(event.elapsedMs)}</Badge>
          {event.outputPreview && (
            <span className="text-slate-500 truncate ml-1">— {event.outputPreview}</span>
          )}
        </>
      );
      break;

    case "step_error":
      icon = "✗";
      borderColor = "border-red-700";
      line = (
        <>
          <span className="text-red-400">{displayAgent(event.agent ?? "?")}</span>
          <Badge color="red">error</Badge>
          {event.error && (
            <span className="text-red-300/80 truncate ml-1">— {event.error}</span>
          )}
        </>
      );
      break;

    case "chain_done":
      icon = event.success ? "✓" : "✗";
      borderColor = event.success ? "border-emerald-700" : "border-red-700";
      line = (
        <>
          <span className={event.success ? "text-emerald-400" : "text-red-400"}>
            {event.chain}
          </span>
          <Badge color={event.success ? "green" : "red"}>
            {formatDuration(event.elapsedMs)}
          </Badge>
        </>
      );
      break;

    case "task_transition":
      icon = "↳";
      borderColor = "border-amber-800";
      line = (
        <>
          <Badge color="amber">{event.taskId}</Badge>
          <span className="text-slate-300 truncate ml-1">{event.title}</span>
          <span className="text-slate-600 mx-1">→</span>
          <Badge color="green">{event.to}</Badge>
          {event.assignee && (
            <span className="text-slate-600 ml-1">({event.assignee})</span>
          )}
        </>
      );
      break;

    case "agent_session":
    default:
      icon = "●";
      borderColor = "border-slate-700";
      line = (
        <>
          <span className="text-sky-400">{displayAgent(event.agent ?? "?")}</span>
          {event.elapsedMs != null && (
            <Badge color="blue">{formatDuration(event.elapsedMs)}</Badge>
          )}
          {event.toolCallCount != null && event.toolCallCount > 0 && (
            <Badge color="gray">{event.toolCallCount} tools</Badge>
          )}
          {event.lastAssistantText && (
            <span className="text-slate-500 truncate ml-1">
              — {event.lastAssistantText.slice(0, 80)}
            </span>
          )}
        </>
      );
      break;
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-l-2 ${borderColor} ${
        selected ? "bg-slate-800" : "hover:bg-slate-800/50"
      } px-3 py-2 flex items-start gap-2 text-xs transition-colors`}
    >
      <span className="shrink-0 w-4 text-center text-slate-500">{icon}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
        {line}
      </div>
      <span className="shrink-0 text-[10px] text-slate-600" title={event.at}>
        {timeAgo(event.at)}
      </span>
    </button>
  );
}
