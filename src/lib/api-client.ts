import type { Task, Project, AgentConfig, InboxItem, Comment, ScheduledJob, LinearLink, LinearSearchResult, LinearTeam } from "./types"
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
  tool?: string
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
    tool: string
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

// ── Comments ──────────────────────────────────────────────────────

export async function fetchComments(params: {
  taskId?: string
  projectId?: string
  agentRunId?: string
}): Promise<Comment[]> {
  const query = new URLSearchParams()
  if (params.taskId) query.set("taskId", params.taskId)
  if (params.projectId) query.set("projectId", params.projectId)
  if (params.agentRunId) query.set("agentRunId", params.agentRunId)
  const res = await fetch(`/api/comments?${query}`)
  if (!res.ok) throw new Error("Failed to fetch comments")
  return res.json()
}

export async function createComment(data: {
  body: string
  taskId?: string
  projectId?: string
  agentRunId?: string
}): Promise<Comment> {
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create comment")
  return res.json()
}

export async function updateComment(
  id: string,
  data: { body: string }
): Promise<Comment> {
  const res = await fetch(`/api/comments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update comment")
  return res.json()
}

export async function deleteComment(id: string): Promise<void> {
  const res = await fetch(`/api/comments/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete comment")
}

// ── Schedules ─────────────────────────────────────────────────────

export async function fetchSchedules(): Promise<ScheduledJob[]> {
  const res = await fetch("/api/schedules")
  if (!res.ok) throw new Error("Failed to fetch schedules")
  return res.json()
}

export async function createSchedule(data: {
  name: string
  agentConfigId?: string | null
  tool?: string
  model?: string
  prompt: string
  preset: string
  scheduledAt?: string | null
  hour?: number | null
  minute?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  taskMode?: string
  taskId?: string | null
  projectId?: string | null
}): Promise<ScheduledJob> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create schedule" }))
    throw new Error(err.error ?? "Failed to create schedule")
  }
  return res.json()
}

export async function updateSchedule(
  id: string,
  data: Partial<{
    name: string
    agentConfigId: string | null
    tool: string
    model: string
    prompt: string
    preset: string
    scheduledAt: string | null
    hour: number | null
    minute: number | null
    dayOfWeek: number | null
    dayOfMonth: number | null
    taskMode: string
    taskId: string | null
    projectId: string | null
    enabled: boolean
  }>
): Promise<ScheduledJob> {
  const res = await fetch(`/api/schedules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update schedule")
  return res.json()
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete schedule")
}

export async function toggleSchedule(id: string): Promise<ScheduledJob> {
  const res = await fetch(`/api/schedules/${id}/toggle`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to toggle schedule")
  return res.json()
}

export async function approveScheduledRun(inboxItemId: string): Promise<void> {
  const res = await fetch(`/api/inbox/${inboxItemId}/approve-run`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to approve run")
}

export interface ScheduleRun {
  id: string
  status: string
  model: string
  startedAt: string | null
  endedAt: string | null
  costUsd: number | null
  tokenCount: number | null
  task: { id: string; title: string; status: string } | null
}

export async function fetchScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const res = await fetch(`/api/schedules/${scheduleId}/runs`)
  if (!res.ok) return []
  return res.json()
}

// ── Linear ──────────────────────────────────────────────

export async function fetchLinearStatus(): Promise<{ connected: boolean; workspace?: string; email?: string }> {
  const res = await fetch("/api/linear/status")
  if (!res.ok) return { connected: false }
  return res.json()
}

export async function connectLinear(apiKey: string): Promise<{ connected: boolean; workspace?: string; email?: string }> {
  const res = await fetch("/api/linear/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  })
  if (!res.ok) throw new Error("Failed to connect Linear")
  return res.json()
}

export async function fetchLinearTeams(): Promise<LinearTeam[]> {
  const res = await fetch("/api/linear/teams")
  if (!res.ok) throw new Error("Failed to fetch Linear teams")
  return res.json()
}

export async function searchLinearIssues(params: {
  q?: string
  teamId?: string
  status?: string
}): Promise<LinearSearchResult[]> {
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.teamId) query.set("teamId", params.teamId)
  if (params.status) query.set("status", params.status)
  const res = await fetch(`/api/linear/search?${query}`)
  if (!res.ok) throw new Error("Failed to search Linear issues")
  return res.json()
}

export async function importLinearIssues(issueIds: string[], projectId?: string): Promise<Task[]> {
  const res = await fetch("/api/linear/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueIds, projectId }),
  })
  if (!res.ok) throw new Error("Failed to import Linear issues")
  return res.json()
}

export async function fetchLinearLinks(taskId: string): Promise<LinearLink[]> {
  const res = await fetch(`/api/tasks/${taskId}/linear-links`)
  if (!res.ok) throw new Error("Failed to fetch linear links")
  return res.json()
}

export async function createLinearLink(taskId: string, linearIssueId: string): Promise<LinearLink> {
  const res = await fetch(`/api/tasks/${taskId}/linear-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linearIssueId }),
  })
  if (!res.ok) throw new Error("Failed to link Linear issue")
  return res.json()
}

export async function deleteLinearLink(taskId: string, linkId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/linear-links/${linkId}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to unlink Linear issue")
}

export async function syncLinearLinks(taskId: string): Promise<LinearLink[]> {
  const res = await fetch(`/api/tasks/${taskId}/linear-links/sync`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to sync Linear links")
  return res.json()
}
