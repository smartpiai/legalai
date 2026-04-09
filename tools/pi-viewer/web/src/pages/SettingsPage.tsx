import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { yaml as cmYaml } from "@codemirror/lang-yaml";
import { json as cmJson } from "@codemirror/lang-json";
import { toast } from "sonner";

type Entry = { path: string; kind: "yaml" | "json" };

async function j<T>(p: string, init?: RequestInit): Promise<T> {
  const r = await fetch(p, { headers: { "content-type": "application/json" }, ...init });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["settings"], queryFn: () => j<Entry[]>("/api/settings") });
  const [sel, setSel] = useState<Entry | null>(null);
  const [draft, setDraft] = useState("");

  const fileQ = useQuery({
    queryKey: ["settings-file", sel?.path],
    queryFn: () =>
      j<{ content: string }>(`/api/settings/file?path=${encodeURIComponent(sel!.path)}`).then((d) => {
        setDraft(d.content);
        return d;
      }),
    enabled: !!sel,
  });

  const saveM = useMutation({
    mutationFn: () =>
      j(`/api/settings/file?path=${encodeURIComponent(sel!.path)}`, {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["settings-file", sel?.path] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-slate-800 bg-slate-900/30 overflow-y-auto">
        {list.data?.map((e) => (
          <button
            key={e.path}
            onClick={() => setSel(e)}
            className={`block w-full text-left px-3 py-2 text-xs font-mono border-b border-slate-900 ${
              sel?.path === e.path ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800/50"
            }`}
          >
            {e.path}
            <div className="text-[10px] text-slate-600">{e.kind}</div>
          </button>
        ))}
      </aside>
      <div className="flex-1 flex flex-col">
        {sel && fileQ.data ? (
          <>
            <header className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="text-xs font-mono text-slate-300">{sel.path}</div>
              <button
                onClick={() => saveM.mutate()}
                disabled={draft === fileQ.data.content}
                className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40"
              >
                Save
              </button>
            </header>
            <div className="flex-1 overflow-auto">
              <CodeMirror
                value={draft}
                onChange={setDraft}
                extensions={[sel.kind === "json" ? cmJson() : cmYaml()]}
                theme="dark"
                height="100%"
                style={{ fontSize: 13 }}
              />
            </div>
          </>
        ) : (
          <div className="p-8 text-slate-500 text-sm">Select a file.</div>
        )}
      </div>
    </div>
  );
}
