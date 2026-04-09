import { useState } from "react";
import { X } from "lucide-react";
import type { Task } from "../api";

const STATUSES: Task["status"][] = ["pending", "in_progress", "review", "done", "blocked"];
const PRIORITIES = ["p0", "p1", "p2", "p3"];
const GATES = ["kickoff", "design", "pre-merge", "pre-deploy"];

type Props = {
  task: Task;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => void;
};

export default function TaskDrawer({ task, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Partial<Task>>({});
  const v = (k: keyof Task) => (draft[k] ?? (task as any)[k] ?? "") as string;
  const set = (k: keyof Task, val: any) => setDraft((d) => ({ ...d, [k]: val }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-[480px] bg-slate-900 border-l border-slate-800 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-mono">{task.id}</div>
            <div className="text-sm text-slate-200">{task.title}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          <Field label="Title">
            <input
              className="input"
              value={v("title")}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className="input" value={v("status")} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className="input" value={v("priority")} onChange={(e) => set("priority", e.target.value)}>
                <option value="">—</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <input className="input" value={v("assignee")} onChange={(e) => set("assignee", e.target.value)} />
            </Field>
            <Field label="Gate">
              <select className="input" value={v("gate")} onChange={(e) => set("gate", e.target.value)}>
                <option value="">—</option>
                {GATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            {task.type === "doc" && (
              <Field label="Doc Type">
                <input className="input" value={v("docType")} onChange={(e) => set("docType", e.target.value)} />
              </Field>
            )}
            {task.type === "impl" && (
              <Field label="Workstream">
                <input className="input" value={v("workstream")} onChange={(e) => set("workstream", e.target.value)} />
              </Field>
            )}
            <Field label="Chain">
              <input className="input" value={v("chain")} onChange={(e) => set("chain", e.target.value)} />
            </Field>
          </div>
          <Field label="Output">
            <input className="input" value={v("output")} onChange={(e) => set("output", e.target.value)} />
          </Field>
          <Field label="Depends On (comma-sep)">
            <input
              className="input"
              value={(draft.dependsOn ?? task.dependsOn ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "dependsOn",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
            />
          </Field>
          {task.completedAt && (
            <div className="text-xs text-slate-500">Completed: {task.completedAt}</div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={Object.keys(draft).length === 0}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
      <style>{`
        .input {
          width: 100%;
          background: rgb(15 23 42);
          border: 1px solid rgb(30 41 59);
          border-radius: 4px;
          padding: 4px 8px;
          color: rgb(226 232 240);
          font-size: 13px;
        }
        .input:focus { outline: none; border-color: rgb(59 130 246); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
