import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

async function j<T>(p: string): Promise<T> {
  const r = await fetch(p);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type Session = { name: string; size: number; mtime: number };

export default function StatePage() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: () => j<any>("/api/state/progress") });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => j<Session[]>("/api/state/sessions") });
  const [sel, setSel] = useState<string | null>(null);
  const sessionQ = useQuery({
    queryKey: ["session", sel],
    queryFn: () => j<any>(`/api/state/sessions/${sel}`),
    enabled: !!sel,
  });

  return (
    <div className="h-full flex">
      <div className="w-1/2 border-r border-slate-800 overflow-auto p-4">
        <h2 className="text-sm uppercase text-slate-500 mb-2">progress.yaml</h2>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap">
          {progress.data ? JSON.stringify(progress.data, null, 2) : "Loading…"}
        </pre>
      </div>
      <div className="w-1/2 flex flex-col">
        <div className="border-b border-slate-800 p-2">
          <h2 className="text-sm uppercase text-slate-500">sessions ({sessions.data?.length ?? 0})</h2>
        </div>
        <div className="flex-1 overflow-auto">
          {sessions.data?.map((s) => (
            <button
              key={s.name}
              onClick={() => setSel(s.name)}
              className={`block w-full text-left px-3 py-1.5 text-xs font-mono border-b border-slate-900 ${
                sel === s.name ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800/50"
              }`}
            >
              <div>{s.name}</div>
              <div className="text-[10px] text-slate-600">
                {(s.size / 1024).toFixed(1)} KB · {new Date(s.mtime * 1000).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
        {sessionQ.data && (
          <div className="border-t border-slate-800 max-h-[40%] overflow-auto p-3">
            <pre className="text-[10px] text-slate-400">{JSON.stringify(sessionQ.data, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
