import type { Task, Project, AgentConfig, InboxItem } from "./types"
import type { SOP } from "./sops"

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
  status?: string
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

// ── Projects ──────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects")
  if (!res.ok) throw new Error("Failed to fetch projects")
  return res.json()
}

export async function createProject(data: {
  name: string
  color?: string
  emoji?: string
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create project")
  return res.json()
}

export async function updateProject(
  id: string,
  data: Partial<{ name: string; color: string; emoji: string; sortOrder: number }>
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update project")
  return res.json()
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete project")
}

// ── Agents ────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<AgentConfig[]> {
  const res = await fetch("/api/agents")
  if (!res.ok) throw new Error("Failed to fetch agents")
  return res.json()
}

export async function createAgent(data: {
  name: string
  model?: string
  description?: string
  systemPrompt?: string
  defaultSopId?: string | null
}): Promise<AgentConfig> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create agent")
  return res.json()
}

export async function updateAgent(
  id: string,
  data: Partial<{
    name: string
    model: string
    description: string
    systemPrompt: string
    defaultSopId: string | null
  }>
): Promise<AgentConfig> {
  const res = await fetch(`/api/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update agent")
  return res.json()
}

export async function deleteAgent(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete agent")
}

// ── SOPs ──────────────────────────────────────────────────────────

export async function fetchSops(): Promise<SOP[]> {
  const res = await fetch("/api/sops")
  if (!res.ok) throw new Error("Failed to fetch SOPs")
  return res.json()
}

export async function createSop(data: {
  name: string
  description?: string
  stages: { name: string; role: string; prompt: string }[]
}): Promise<SOP> {
  const res = await fetch("/api/sops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create SOP")
  return res.json()
}

export async function updateSop(
  id: string,
  data: {
    name?: string
    description?: string
    stages?: { name: string; role: string; prompt: string }[]
  }
): Promise<SOP> {
  const res = await fetch(`/api/sops/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update SOP")
  return res.json()
}

export async function deleteSop(id: string): Promise<void> {
  const res = await fetch(`/api/sops/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete SOP")
}

// ── Inbox ─────────────────────────────────────────────────────────

export async function fetchInbox(): Promise<InboxItem[]> {
  const res = await fetch("/api/inbox")
  if (!res.ok) throw new Error("Failed to fetch inbox")
  return res.json()
}

export async function updateInboxItem(
  id: string,
  data: Partial<{
    read: boolean
    snoozedUntil: string | null
    replyText: string
    repliedAt: string
  }>
): Promise<InboxItem> {
  const res = await fetch(`/api/inbox/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update inbox item")
  return res.json()
}

export async function deleteInboxItem(id: string): Promise<void> {
  const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete inbox item")
}
