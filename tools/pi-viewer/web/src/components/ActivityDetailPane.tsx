import type { ActivityEvent } from "../lib/activityTypes";
import { formatDuration } from "../lib/formatDuration";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 border-b border-slate-800/60 text-xs">
      <span className="text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-slate-300 break-words min-w-0">{children || "—"}</span>
    </div>
  );
}

export default function ActivityDetailPane({
  event,
  onNavigateSession,
}: {
  event: ActivityEvent;
  onNavigateSession?: (file: string) => void;
}) {
  const k = event.kind;

  return (
    <div className="p-4 space-y-1 overflow-auto">
      <h3 className="text-sm text-slate-200 mb-3 font-medium">
        {k.replace(/_/g, " ")}
      </h3>

      <Row label="Timestamp">{new Date(event.at).toLocaleString()}</Row>

      {event.agent && <Row label="Agent">{event.agent}</Row>}
      {event.chain && <Row label="Chain">{event.chain}</Row>}
      {event.chain_id && <Row label="Chain ID">{event.chain_id}</Row>}
      {event.step != null && <Row label="Step">{event.step}</Row>}
      {event.elapsedMs != null && (
        <Row label="Elapsed">{formatDuration(event.elapsedMs)}</Row>
      )}
      {event.success != null && (
        <Row label="Success">{event.success ? "yes" : "no"}</Row>
      )}

      {/* agent_session specific */}
      {k === "agent_session" && (
        <>
          <Row label="Task">
            <span className="text-slate-300/80 text-[11px]">
              {event.firstUserText}
            </span>
          </Row>
          <Row label="Last output">
            <span className="text-slate-300/80 text-[11px]">
              {event.lastAssistantText}
            </span>
          </Row>
          {event.toolCallCount != null && (
            <Row label="Tool calls">
              {event.toolCallCount}
              {event.lastToolName && (
                <span className="text-slate-500 ml-1">(last: {event.lastToolName})</span>
              )}
            </Row>
          )}
          {event.sessionFile && (
            <Row label="Session file">
              {onNavigateSession ? (
                <button
                  className="text-sky-400 hover:underline"
                  onClick={() => onNavigateSession(event.sessionFile!)}
                >
                  {event.sessionFile}
                </button>
              ) : (
                event.sessionFile
              )}
            </Row>
          )}
        </>
      )}

      {/* step-level */}
      {event.promptPreview && (
        <Row label="Prompt">
          <span className="text-slate-300/80 text-[11px]">{event.promptPreview}</span>
        </Row>
      )}
      {event.outputPreview && (
        <Row label="Output">
          <span className="text-slate-300/80 text-[11px]">{event.outputPreview}</span>
        </Row>
      )}
      {event.error && (
        <Row label="Error">
          <span className="text-red-400 text-[11px]">{event.error}</span>
        </Row>
      )}

      {/* task_transition */}
      {k === "task_transition" && (
        <>
          <Row label="Task">{event.taskId}</Row>
          <Row label="Title">{event.title}</Row>
          <Row label="Sprint">{event.sprintFile}</Row>
          {event.assignee && <Row label="Assignee">{event.assignee}</Row>}
          {event.chain && <Row label="Chain">{event.chain}</Row>}
          <Row label="Transition">
            {event.from ?? "?"} → {event.to}
          </Row>
        </>
      )}

      {/* steps list for chain_start */}
      {event.steps && (
        <Row label="Steps">
          <ol className="list-decimal list-inside">
            {event.steps.map((s, i) => (
              <li key={i} className="text-slate-400">
                {s}
              </li>
            ))}
          </ol>
        </Row>
      )}

      {/* raw JSON fallback */}
      <details className="mt-4">
        <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400">
          raw JSON
        </summary>
        <pre className="text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">
          {JSON.stringify(event, null, 2)}
        </pre>
      </details>
    </div>
  );
}
