import ReactFlow, { Background, Controls, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

type Step = { agent: string; prompt: string };

export default function ChainGraph({ steps }: { steps: Step[] }) {
  const nodes: Node[] = steps.map((s, i) => ({
    id: `s${i}`,
    position: { x: 60, y: i * 140 },
    data: {
      label: (
        <div className="text-left">
          <div className="text-[10px] text-slate-400 uppercase">Step {i + 1}</div>
          <div className="text-sm font-semibold text-slate-100">{s.agent}</div>
          <div className="text-[10px] text-slate-400 mt-1 max-w-[260px] line-clamp-3">
            {s.prompt.replace(/\s+/g, " ").slice(0, 160)}…
          </div>
        </div>
      ),
    },
    style: {
      background: "rgb(15 23 42)",
      color: "rgb(226 232 240)",
      border: "1px solid rgb(51 65 85)",
      borderRadius: 6,
      padding: 8,
      width: 280,
    },
  }));
  const edges: Edge[] = steps.slice(1).map((_, i) => ({
    id: `e${i}`,
    source: `s${i}`,
    target: `s${i + 1}`,
    label: i === 0 ? "$ORIGINAL → $INPUT" : "$INPUT",
    labelStyle: { fill: "#94a3b8", fontSize: 10 },
    style: { stroke: "#475569" },
    animated: true,
  }));

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView>
      <Background color="#1e293b" />
      <Controls />
    </ReactFlow>
  );
}
