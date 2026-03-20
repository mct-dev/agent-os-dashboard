// ── Shared Types ──────────────────────────────────────────────────

export type Project = {
  id: string
  name: string
  color: string
  emoji: string
}

export type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE"
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "STOPPED"

export interface AgentRun {
  id: string
  status: RunStatus
  model: string
  costUsd: number | null
  tokenCount: number | null
  startedAt: string
  endedAt: string | null
  bridgeRunId: string | null
  prompt: string | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  projectId: string
  status: Status
  priority: Priority
  sopId: string | null
  createdAt: string
  updatedAt: string
  runs: AgentRun[]
}

export interface InboxItem {
  id: string
  agentName: string
  taskTitle: string
  taskId: string
  question: string
  priority: Priority
  timestamp: string
  read: boolean
  snoozedUntil: string | null
}

export interface AgentConfig {
  id: string
  name: string
  model: string
  description: string
  systemPrompt: string
  defaultSopId: string | null
}

export const LLM_MODELS = [
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-5.4",
  "openai/o4-mini",
  "openai-codex/gpt-5.3-codex",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
] as const

export const STATUS_CONFIG: Record<Status, { label: string; color: string; dotColor: string }> = {
  BACKLOG: { label: "Backlog", color: "text-gray-400", dotColor: "bg-gray-400" },
  TODO: { label: "Todo", color: "text-blue-400", dotColor: "bg-blue-400" },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-400", dotColor: "bg-amber-400" },
  IN_REVIEW: { label: "In Review", color: "text-purple-400", dotColor: "bg-purple-400" },
  BLOCKED: { label: "Blocked", color: "text-red-400", dotColor: "bg-red-400" },
  DONE: { label: "Done", color: "text-green-400", dotColor: "bg-green-400" },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; color: string }> = {
  URGENT: { label: "Urgent", icon: "⬆", color: "text-red-400" },
  HIGH: { label: "High", icon: "↑", color: "text-orange-400" },
  MEDIUM: { label: "Medium", icon: "→", color: "text-blue-400" },
  LOW: { label: "Low", icon: "↓", color: "text-gray-400" },
}

export const STATUSES: Status[] = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]
