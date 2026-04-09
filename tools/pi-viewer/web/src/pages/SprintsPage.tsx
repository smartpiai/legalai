import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { toast } from "sonner";
import { api, type Sprint, type Task } from "../api";
import KanbanBoard from "../components/KanbanBoard";
import TaskDrawer from "../components/TaskDrawer";

export default function SprintsPage() {
  const qc = useQueryClient();
  const sprintsQ = useQuery({ queryKey: ["sprints"], queryFn: api.listSprints });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [approvalsOnly, setApprovalsOnly] = useState(false);

  const activeId =
    selectedId ??
    sprintsQ.data?.find((s) => s.status === "active")?.id ??
    sprintsQ.data?.[0]?.id ??
    null;

  const sprintQ = useQuery<Sprint>({
    queryKey: ["sprint", activeId],
    queryFn: () => api.getSprint(activeId!),
    enabled: activeId != null,
  });

  const patchM = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<Task> }) =>
      api.patchTask(activeId!, taskId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint", activeId] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (sprintsQ.isLoading) return <div className="p-8 text-slate-400">Loading sprints…</div>;
  if (sprintsQ.error) return <div className="p-8 text-red-400">{String(sprintsQ.error)}</div>;

  const tasks = sprintQ.data?.backlog ?? [];
  const visibleTasks = approvalsOnly
    ? tasks.filter((t) => t.status === "review" || t.status === "blocked")
    : tasks;

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center gap-4">
        <select
          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm"
          value={activeId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {sprintsQ.data?.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.id} {s.name} ({s.status})
            </option>
          ))}
        </select>
        {sprintQ.data && (
          <div className="text-xs text-slate-500">
            {sprintQ.data.startDate} → {sprintQ.data.endDate} · {tasks.length} tasks
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={approvalsOnly}
            onChange={(e) => setApprovalsOnly(e.target.checked)}
          />
          Approvals only
        </label>
      </header>
      <div className="flex-1 overflow-hidden">
        <DndProvider backend={HTML5Backend}>
          <KanbanBoard
            tasks={visibleTasks}
            onMove={(taskId, status) => patchM.mutate({ taskId, patch: { status } })}
            onOpen={(t) => setOpenTask(t)}
          />
        </DndProvider>
      </div>
      {openTask && (
        <TaskDrawer
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSave={(patch) =>
            patchM.mutate(
              { taskId: openTask.id, patch },
              { onSuccess: () => setOpenTask(null) }
            )
          }
        />
      )}
    </div>
  );
}
