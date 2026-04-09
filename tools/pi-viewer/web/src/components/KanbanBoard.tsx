import { useDrag, useDrop } from "react-dnd";
import clsx from "clsx";
import type { Task } from "../api";

const COLUMNS: Task["status"][] = ["pending", "in_progress", "review", "done", "blocked"];
const COLUMN_LABELS: Record<Task["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

type Props = {
  tasks: Task[];
  onMove: (taskId: string, status: Task["status"]) => void;
  onOpen: (task: Task) => void;
};

export default function KanbanBoard({ tasks, onMove, onOpen }: Props) {
  return (
    <div className="h-full grid grid-cols-5 gap-3 p-4 overflow-x-auto">
      {COLUMNS.map((status) => (
        <Column
          key={status}
          status={status}
          tasks={tasks.filter((t) => t.status === status)}
          onMove={onMove}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function Column({
  status,
  tasks,
  onMove,
  onOpen,
}: {
  status: Task["status"];
  tasks: Task[];
  onMove: Props["onMove"];
  onOpen: Props["onOpen"];
}) {
  const [{ isOver }, dropRef] = useDrop({
    accept: "task",
    drop: (item: { id: string; status: Task["status"] }) => {
      if (item.status !== status) onMove(item.id, status);
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });

  return (
    <div
      ref={dropRef as any}
      className={clsx(
        "flex flex-col rounded bg-slate-900/50 border border-slate-800 min-h-0",
        isOver && "border-blue-500 bg-slate-900"
      )}
    >
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {COLUMN_LABELS[status]}
        </div>
        <div className="text-xs text-slate-600">{tasks.length}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((t) => (
          <Card key={t.id} task={t} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  p0: "bg-red-500",
  p1: "bg-orange-500",
  p2: "bg-yellow-500",
  p3: "bg-slate-500",
};

function Card({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const [{ isDragging }, dragRef] = useDrag({
    type: "task",
    item: { id: task.id, status: task.status },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  return (
    <div
      ref={dragRef as any}
      onClick={() => onOpen(task)}
      className={clsx(
        "rounded border border-slate-800 bg-slate-900 p-2 cursor-pointer hover:border-slate-600",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-slate-500 font-mono">{task.id}</span>
        {task.priority && (
          <span
            className={clsx(
              "text-[10px] px-1 rounded text-white",
              PRIORITY_COLOR[task.priority] || "bg-slate-600"
            )}
          >
            {task.priority}
          </span>
        )}
        {task.gate && (
          <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-300">
            {task.gate}
          </span>
        )}
      </div>
      <div className="text-sm text-slate-200 leading-tight">{task.title}</div>
      {task.assignee && (
        <div className="text-[11px] text-slate-500 mt-1">@{task.assignee}</div>
      )}
    </div>
  );
}
