export type SprintSummary = {
  id: number;
  name: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  roadmapPhases: string[];
  taskCount: number;
  file: string;
};

export type Task = {
  id: string;
  title: string;
  type: "doc" | "impl";
  status: "pending" | "in_progress" | "review" | "done" | "blocked";
  assignee?: string;
  priority?: string;
  gate?: string;
  docType?: string;
  workstream?: string;
  chain?: string;
  phase?: string;
  output?: string;
  completedAt?: string;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  touches?: string[];
};

export type Sprint = {
  id: number;
  name: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  roadmapPhases: string[];
  backlog: Task[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  listSprints: () => req<SprintSummary[]>("/api/sprints"),
  getSprint: (id: number) => req<Sprint>(`/api/sprints/${id}`),
  patchTask: (sprintId: number, taskId: string, patch: Partial<Task>) =>
    req<Task>(`/api/sprints/${sprintId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};
