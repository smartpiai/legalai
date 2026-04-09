import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ActivityEvent, ActivityKind } from "../lib/activityTypes";
import ActivityEventRow from "../components/ActivityEventRow";
import ActivityDetailPane from "../components/ActivityDetailPane";

async function fetchActivity(kinds?: ActivityKind[]): Promise<ActivityEvent[]> {
  const params = new URLSearchParams();
  params.set("limit", "500");
  if (kinds && kinds.length) params.set("kinds", kinds.join(","));
  const res = await fetch(`/api/state/activity?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const ALL_KINDS: { value: ActivityKind; label: string }[] = [
  { value: "chain_start", label: "Chain start" },
  { value: "chain_done", label: "Chain done" },
  { value: "step_start", label: "Step start" },
  { value: "step_done", label: "Step done" },
  { value: "step_error", label: "Step error" },
  { value: "agent_session", label: "Agent session" },
  { value: "task_transition", label: "Task transition" },
];

export default function ActivityPage() {
  const [selectedKinds, setSelectedKinds] = useState<ActivityKind[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity", selectedKinds],
    queryFn: () => fetchActivity(selectedKinds.length ? selectedKinds : undefined),
    refetchInterval: 15_000,
  });

  const events = data ?? [];
  const selected = selectedIdx != null ? events[selectedIdx] : null;

  const toggleKind = (k: ActivityKind) => {
    setSelectedKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
    setSelectedIdx(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* filter bar */}
      <div className="shrink-0 border-b border-slate-800 px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide mr-1">
          Filter
        </span>
        {ALL_KINDS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => toggleKind(value)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              selectedKinds.includes(value)
                ? "bg-sky-900/50 text-sky-300"
                : "bg-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
        {selectedKinds.length > 0 && (
          <button
            onClick={() => {
              setSelectedKinds([]);
              setSelectedIdx(null);
            }}
            className="text-[10px] text-slate-600 hover:text-slate-400 ml-1"
          >
            clear
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-600">
          {events.length} events
        </span>
      </div>

      {/* main body */}
      <div className="flex-1 flex min-h-0">
        {/* timeline */}
        <div className="w-1/2 border-r border-slate-800 overflow-auto">
          {isLoading && (
            <div className="p-4 text-xs text-slate-500">Loading…</div>
          )}
          {error && (
            <div className="p-4 text-xs text-red-400">
              Error: {(error as Error).message}
            </div>
          )}
          {!isLoading && events.length === 0 && (
            <div className="p-4 text-xs text-slate-500">
              No activity events yet. Run a chain or sprint to see events here.
            </div>
          )}
          {events.map((e, i) => (
            <ActivityEventRow
              key={`${e.at}-${e.kind}-${i}`}
              event={e}
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(i)}
            />
          ))}
        </div>

        {/* detail pane */}
        <div className="w-1/2 overflow-auto">
          {selected ? (
            <ActivityDetailPane
              event={selected}
              onNavigateSession={(file) => navigate(`/state?session=${file}`)}
            />
          ) : (
            <div className="p-4 text-xs text-slate-500">
              Select an event to see details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
