import type { Task } from "./types"

// ── Task CRUD ──────────────────────────────────────────────────────

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch("/api/tasks")
  if (!res.ok) throw new Error("Failed to fetch tasks")
  return res.json()
}

export async function createTask(data: {
  title: string
  description?: string
  projectId: string
  priority: string
  sopId?: string
}): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create task")
  return res.json()
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string
    description: string | null
    status: string
    priority: string
    projectId: string
    sopId: string | null
  }>
): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update task")
  return res.json()
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete task")
}

// ── Agent Runs ─────────────────────────────────────────────────────

export async function startRun(data: {
  taskId: string
  model: string
  prompt: string
}): Promise<{ id: string; bridgeRunId: string }> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to start run")
  return res.json()
}

export async function stopRun(runId: string): Promise<void> {
  const res = await fetch(`/api/runs/${runId}/stop`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to stop run")
}
