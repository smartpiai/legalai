import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { LayoutGrid, GitBranch, FileText, Activity, Settings } from "lucide-react";
import SprintsPage from "./pages/SprintsPage";
import { useLiveReload } from "./lib/useLiveReload";
import AgentsPage from "./pages/AgentsPage";
import DocsPage from "./pages/DocsPage";
import StatePage from "./pages/StatePage";
import SettingsPage from "./pages/SettingsPage";

const NAV = [
  { to: "/sprints", label: "Sprints", icon: LayoutGrid },
  { to: "/agents", label: "Agents", icon: GitBranch },
  { to: "/docs", label: "Docs", icon: FileText },
  { to: "/state", label: "State", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Stub({ name }: { name: string }) {
  return (
    <div className="p-8 text-slate-400">
      <h1 className="text-2xl text-slate-200 mb-2">{name}</h1>
      <p>Coming in the next implementation step.</p>
    </div>
  );
}

export default function App() {
  useLiveReload();
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="text-sm text-slate-400">pi-viewer</div>
          <div className="text-xs text-slate-600">.pi/ runtime</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  isActive
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/sprints" replace />} />
          <Route path="/sprints" element={<SprintsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/state" element={<StatePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
