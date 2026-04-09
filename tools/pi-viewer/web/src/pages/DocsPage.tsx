import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { toast } from "sonner";

type DocEntry = {
  path: string;
  name: string;
  phase: string;
  title: string;
  docType?: string;
  status?: string;
};

async function j<T>(p: string, init?: RequestInit): Promise<T> {
  const r = await fetch(p, { headers: { "content-type": "application/json" }, ...init });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function DocsPage() {
  const qc = useQueryClient();
  const tree = useQuery({ queryKey: ["docs", "tree"], queryFn: () => j<DocEntry[]>("/api/docs/tree") });
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  const phases = useMemo(
    () => Array.from(new Set((tree.data || []).map((d) => d.phase))).sort(),
    [tree.data]
  );
  const filtered = (tree.data || []).filter((d) => !phaseFilter || d.phase === phaseFilter);

  const fileQ = useQuery({
    queryKey: ["doc", selected],
    queryFn: () =>
      j<{ content: string }>(`/api/docs/file?path=${encodeURIComponent(selected!)}`).then((d) => {
        setDraft(d.content);
        return d;
      }),
    enabled: !!selected,
  });

  const saveM = useMutation({
    mutationFn: () =>
      j(`/api/docs/file?path=${encodeURIComponent(selected!)}`, {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["doc", selected] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-slate-800 overflow-y-auto bg-slate-900/30">
        <div className="p-2 border-b border-slate-800">
          <select
            className="w-full bg-slate-900 border border-slate-800 rounded text-xs p-1"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
          >
            <option value="">All phases</option>
            {phases.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {filtered.map((d) => (
          <button
            key={d.path}
            onClick={() => {
              setSelected(d.path);
              setEditing(false);
            }}
            className={`block w-full text-left px-3 py-2 text-xs border-b border-slate-900 ${
              selected === d.path ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800/50"
            }`}
          >
            <div className="text-slate-300">{d.name}</div>
            <div className="text-[10px] text-slate-600">{d.phase}{d.docType ? ` · ${d.docType}` : ""}</div>
          </button>
        ))}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {selected && fileQ.data ? (
          <>
            <header className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="text-xs font-mono text-slate-400 truncate">{selected}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing((e) => !e)}
                  className="px-3 py-1 text-xs rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {editing ? "Preview" : "Edit"}
                </button>
                {editing && (
                  <button
                    onClick={() => saveM.mutate()}
                    disabled={draft === fileQ.data.content}
                    className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                )}
              </div>
            </header>
            <div className="flex-1 overflow-auto">
              {editing ? (
                <CodeMirror
                  value={draft}
                  onChange={setDraft}
                  extensions={[markdown()]}
                  theme="dark"
                  height="100%"
                  style={{ fontSize: 13 }}
                />
              ) : (
                <article className="prose prose-invert max-w-3xl p-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileQ.data.content}</ReactMarkdown>
                </article>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-slate-500 text-sm">Select a document.</div>
        )}
      </div>
    </div>
  );
}
