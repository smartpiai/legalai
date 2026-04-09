import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { toast } from "sonner";
import ChainGraph from "../components/ChainGraph";

type PersonaList = Record<string, { name: string; file: string }[]>;
type ChainStep = { agent: string; prompt: string };
type Chains = Record<string, ChainStep[]>;

async function j<T>(p: string, init?: RequestInit): Promise<T> {
  const r = await fetch(p, { headers: { "content-type": "application/json" }, ...init });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const personasQ = useQuery({
    queryKey: ["personas"],
    queryFn: () => j<PersonaList>("/api/agents/personas"),
  });
  const chainsQ = useQuery({
    queryKey: ["chains"],
    queryFn: () => j<Chains>("/api/agents/chains"),
  });

  const [selected, setSelected] = useState<{ category: string; name: string } | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  const personaQ = useQuery({
    queryKey: ["persona", selected?.category, selected?.name],
    queryFn: () =>
      j<{ content: string }>(
        `/api/agents/personas/${selected!.category}/${selected!.name}`
      ).then((d) => {
        setDraft(d.content);
        return d;
      }),
    enabled: !!selected,
  });

  const saveM = useMutation({
    mutationFn: () =>
      j(`/api/agents/personas/${selected!.category}/${selected!.name}`, {
        method: "PUT",
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      toast.success("Persona saved");
      qc.invalidateQueries({ queryKey: ["persona"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="h-full flex">
      <aside className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-900/30">
        {personasQ.data &&
          Object.entries(personasQ.data).map(([cat, items]) => (
            <div key={cat} className="py-2">
              <div className="px-3 text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                {cat}
              </div>
              {items.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelected({ category: cat, name: p.name })}
                  className={`block w-full text-left px-3 py-1 text-sm ${
                    selected?.name === p.name && selected.category === cat
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ))}
        <div className="border-t border-slate-800 mt-2 py-2">
          <div className="px-3 text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            chains
          </div>
          {chainsQ.data &&
            Object.keys(chainsQ.data).map((name) => (
              <button
                key={name}
                onClick={() => {
                  setSelectedChain(name);
                  setSelected(null);
                }}
                className={`block w-full text-left px-3 py-1 text-sm font-mono ${
                  selectedChain === name
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-800/50"
                }`}
              >
                {name}
              </button>
            ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {selected && personaQ.data && (
          <>
            <header className="border-b border-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="text-sm text-slate-300">
                {selected.category} / <span className="text-slate-100">{selected.name}</span>
              </div>
              <button
                onClick={() => saveM.mutate()}
                disabled={draft === personaQ.data.content}
                className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40"
              >
                Save
              </button>
            </header>
            <div className="flex-1 overflow-auto">
              <CodeMirror
                value={draft}
                onChange={setDraft}
                extensions={[markdown()]}
                theme="dark"
                height="100%"
                style={{ fontSize: 13 }}
              />
            </div>
          </>
        )}
        {selectedChain && chainsQ.data && (
          <>
            <header className="border-b border-slate-800 px-4 py-2 text-sm text-slate-300">
              chain / <span className="font-mono text-slate-100">{selectedChain}</span>
            </header>
            <div className="flex-1">
              <ChainGraph steps={chainsQ.data[selectedChain]} />
            </div>
          </>
        )}
        {!selected && !selectedChain && (
          <div className="p-8 text-slate-500 text-sm">
            Select a persona or chain from the left.
          </div>
        )}
      </div>
    </div>
  );
}
