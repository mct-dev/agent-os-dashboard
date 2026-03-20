import type { Task, Project, InboxItem, AgentConfig } from "./types"

export const MOCK_PROJECTS: Project[] = [
  { id: "laurel", name: "Laurel", color: "#3b82f6", emoji: "🔵" },
  { id: "personal", name: "Personal", color: "#22c55e", emoji: "🟢" },
  { id: "side", name: "Side Projects", color: "#eab308", emoji: "🟡" },
  { id: "life", name: "Life", color: "#94a3b8", emoji: "⚪" },
]

export const MOCK_AGENTS: AgentConfig[] = [
  {
    id: "bmad-full",
    name: "BMAD Full",
    model: "anthropic/claude-opus-4-6",
    description: "Full pipeline: BA → PM → Arch → Dev → QA → CR",
    systemPrompt: "You are a full-stack development pipeline agent. Follow the BMAD methodology through all stages.",
    defaultSopId: "bmad-full",
  },
  {
    id: "dev-qa",
    name: "Dev + QA",
    model: "anthropic/claude-sonnet-4-6",
    description: "Streamlined: Dev → QA → Code Review",
    systemPrompt: "You are a development agent focused on implementation and quality assurance.",
    defaultSopId: "bmad-dev",
  },
  {
    id: "quick-think",
    name: "Quick Think",
    model: "google/gemini-3-flash-preview",
    description: "Fast planning: PM → Architect only",
    systemPrompt: "You are a rapid planning agent. Produce concise specs and architecture decisions.",
    defaultSopId: "quick-think",
  },
]

let _taskIdCounter = 21

export function nextTaskId(): string {
  return String(++_taskIdCounter)
}

export const MOCK_TASKS: Task[] = [
  {
    id: "1", title: "Build auth system with OAuth providers",
    description: "Implement NextAuth with Google and GitHub OAuth. Handle session management, token refresh, and role-based access control.",
    projectId: "laurel", status: "IN_PROGRESS", priority: "HIGH", sopId: "bmad-full",
    createdAt: "2026-03-19T10:00:00Z", updatedAt: "2026-03-19T11:00:00Z",
    runs: [{ id: "r1", status: "RUNNING", model: "anthropic/claude-opus-4-6", costUsd: 0.42, tokenCount: 12400, startedAt: "2026-03-19T11:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "2", title: "Regression incident captainship kickoff",
    description: "Analyze top regression sources across the org. Create tracking projects and hand off to engineering leads.",
    projectId: "laurel", status: "TODO", priority: "URGENT", sopId: "bmad-dev",
    createdAt: "2026-03-18T09:00:00Z", updatedAt: "2026-03-18T09:00:00Z", runs: [],
  },
  {
    id: "3", title: "Set up Paperclip PM2 auto-restart",
    description: "Configure PM2 with --max-memory-restart 1500M for the Paperclip assistant process.",
    projectId: "laurel", status: "DONE", priority: "MEDIUM", sopId: null,
    createdAt: "2026-03-17T08:00:00Z", updatedAt: "2026-03-17T16:00:00Z",
    runs: [{ id: "r2", status: "COMPLETED", model: "anthropic/claude-sonnet-4-6", costUsd: 0.08, tokenCount: 3200, startedAt: "2026-03-17T15:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "4", title: "Evening CoS workflow automation",
    description: "Automate the 7:10pm PT check-in prompt and recap pipeline with Life OS integration.",
    projectId: "personal", status: "BACKLOG", priority: "MEDIUM", sopId: "quick-think",
    createdAt: "2026-03-19T08:00:00Z", updatedAt: "2026-03-19T08:00:00Z", runs: [],
  },
  {
    id: "5", title: "Gym tracker data model",
    description: "Design schema for workout logging — exercises, sets, reps, weight, progression tracking.",
    projectId: "side", status: "BACKLOG", priority: "LOW", sopId: null,
    createdAt: "2026-03-15T12:00:00Z", updatedAt: "2026-03-15T12:00:00Z", runs: [],
  },
  {
    id: "6", title: "Meal prep schedule",
    description: "Plan weekly meal prep aligned with workout days A/B/C.",
    projectId: "life", status: "TODO", priority: "LOW", sopId: null,
    createdAt: "2026-03-14T10:00:00Z", updatedAt: "2026-03-14T10:00:00Z", runs: [],
  },
  {
    id: "7", title: "Implement task drag-and-drop",
    description: "Add drag-and-drop to kanban board columns. Use @dnd-kit or native HTML5 DnD.",
    projectId: "personal", status: "TODO", priority: "HIGH", sopId: "bmad-dev",
    createdAt: "2026-03-18T14:00:00Z", updatedAt: "2026-03-18T14:00:00Z", runs: [],
  },
  {
    id: "8", title: "Deploy Supabase Edge Functions",
    description: "Set up edge functions for real-time task sync and webhook handlers.",
    projectId: "laurel", status: "IN_REVIEW", priority: "HIGH", sopId: "bmad-full",
    createdAt: "2026-03-16T09:00:00Z", updatedAt: "2026-03-19T08:00:00Z",
    runs: [{ id: "r3", status: "COMPLETED", model: "anthropic/claude-opus-4-6", costUsd: 1.23, tokenCount: 48200, startedAt: "2026-03-18T16:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "9", title: "Fix Linear webhook duplicate events",
    description: "Deduplicate incoming Linear webhooks. Events are firing 2-3x per state change.",
    projectId: "laurel", status: "BLOCKED", priority: "URGENT", sopId: "bmad-dev",
    createdAt: "2026-03-19T07:00:00Z", updatedAt: "2026-03-19T09:00:00Z", runs: [],
  },
  {
    id: "10", title: "Design agent memory architecture",
    description: "Define how agents persist context across runs. Evaluate vector DB vs structured storage.",
    projectId: "personal", status: "IN_PROGRESS", priority: "HIGH", sopId: "quick-think",
    createdAt: "2026-03-17T11:00:00Z", updatedAt: "2026-03-19T10:00:00Z",
    runs: [{ id: "r4", status: "RUNNING", model: "google/gemini-3-flash-preview", costUsd: 0.02, tokenCount: 4100, startedAt: "2026-03-19T10:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "11", title: "API rate limiter middleware",
    description: "Add token bucket rate limiting to all API routes. Per-user and per-IP.",
    projectId: "laurel", status: "TODO", priority: "MEDIUM", sopId: "bmad-dev",
    createdAt: "2026-03-18T10:00:00Z", updatedAt: "2026-03-18T10:00:00Z", runs: [],
  },
  {
    id: "12", title: "Squad CLI PR monitor improvements",
    description: "Add retry logic and better error messages for the PR monitor cron job.",
    projectId: "personal", status: "DONE", priority: "MEDIUM", sopId: "bmad-dev",
    createdAt: "2026-03-15T09:00:00Z", updatedAt: "2026-03-17T14:00:00Z",
    runs: [{ id: "r5", status: "COMPLETED", model: "anthropic/claude-sonnet-4-6", costUsd: 0.15, tokenCount: 6800, startedAt: "2026-03-17T13:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "13", title: "Set up weekly review automation",
    description: "Automate the Friday weekly review: pull completed tasks, wins, blockers into a summary.",
    projectId: "life", status: "BACKLOG", priority: "LOW", sopId: "quick-think",
    createdAt: "2026-03-13T08:00:00Z", updatedAt: "2026-03-13T08:00:00Z", runs: [],
  },
  {
    id: "14", title: "Dark mode color audit",
    description: "Review all dark mode colors for accessibility. WCAG AA contrast ratios.",
    projectId: "side", status: "TODO", priority: "LOW", sopId: null,
    createdAt: "2026-03-16T14:00:00Z", updatedAt: "2026-03-16T14:00:00Z", runs: [],
  },
  {
    id: "15", title: "Implement SSE run streaming",
    description: "Wire up Server-Sent Events for real-time agent run output in the task panel.",
    projectId: "personal", status: "IN_PROGRESS", priority: "URGENT", sopId: "bmad-full",
    createdAt: "2026-03-18T16:00:00Z", updatedAt: "2026-03-19T09:00:00Z",
    runs: [{ id: "r6", status: "RUNNING", model: "anthropic/claude-opus-4-6", costUsd: 0.67, tokenCount: 22100, startedAt: "2026-03-19T09:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "16", title: "Onboard new QA agent template",
    description: "Create a QA-focused agent template with test generation and coverage analysis prompts.",
    projectId: "laurel", status: "BACKLOG", priority: "MEDIUM", sopId: "bmad-full",
    createdAt: "2026-03-17T13:00:00Z", updatedAt: "2026-03-17T13:00:00Z", runs: [],
  },
  {
    id: "17", title: "Reading list Shortcut automation",
    description: "Create iOS Shortcut that captures links to Apple Reminders → Reading List.",
    projectId: "life", status: "DONE", priority: "LOW", sopId: null,
    createdAt: "2026-03-12T10:00:00Z", updatedAt: "2026-03-14T15:00:00Z",
    runs: [{ id: "r7", status: "COMPLETED", model: "anthropic/claude-haiku-4-5", costUsd: 0.01, tokenCount: 800, startedAt: "2026-03-14T14:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "18", title: "Migrate Prisma to Drizzle ORM",
    description: "Evaluate and migrate from Prisma to Drizzle for better edge runtime support.",
    projectId: "side", status: "IN_REVIEW", priority: "MEDIUM", sopId: "bmad-full",
    createdAt: "2026-03-14T11:00:00Z", updatedAt: "2026-03-18T17:00:00Z",
    runs: [{ id: "r8", status: "COMPLETED", model: "anthropic/claude-opus-4-6", costUsd: 2.10, tokenCount: 67000, startedAt: "2026-03-18T14:00:00Z", endedAt: null, bridgeRunId: null, prompt: null }],
  },
  {
    id: "19", title: "Add Tailscale ACL rules for agent bridge",
    description: "Configure Tailscale ACLs so the Vercel app can reach the local agent bridge securely.",
    projectId: "personal", status: "BLOCKED", priority: "HIGH", sopId: null,
    createdAt: "2026-03-19T06:00:00Z", updatedAt: "2026-03-19T07:00:00Z", runs: [],
  },
  {
    id: "20", title: "Write BMAD methodology docs",
    description: "Document the full BMAD pipeline methodology for the Agent OS README.",
    projectId: "personal", status: "TODO", priority: "MEDIUM", sopId: "quick-think",
    createdAt: "2026-03-18T08:00:00Z", updatedAt: "2026-03-18T08:00:00Z", runs: [],
  },
]

export const MOCK_INBOX: InboxItem[] = [
  {
    id: "inbox-1",
    agentName: "BMAD Full",
    taskTitle: "Build auth system with OAuth providers",
    taskId: "1",
    question: "Need clarification on OAuth provider selection — should I implement Google OAuth, GitHub OAuth, or both? The task description mentions both but the Supabase config only has Google credentials set up.",
    priority: "HIGH",
    timestamp: "2026-03-19T11:23:00Z",
    read: false,
    snoozedUntil: null,
  },
  {
    id: "inbox-2",
    agentName: "Dev + QA",
    taskTitle: "Fix Linear webhook duplicate events",
    taskId: "9",
    question: "I've identified the issue — Linear sends both 'update' and 'state change' events for status transitions. Should I deduplicate by event ID with a 5s window, or filter to only 'state change' events?",
    priority: "URGENT",
    timestamp: "2026-03-19T09:45:00Z",
    read: false,
    snoozedUntil: null,
  },
  {
    id: "inbox-3",
    agentName: "BMAD Full",
    taskTitle: "Deploy Supabase Edge Functions",
    taskId: "8",
    question: "The edge function bundle size exceeds the 2MB limit due to the Prisma client. Should I switch to direct SQL queries for edge functions, or split into smaller functions?",
    priority: "MEDIUM",
    timestamp: "2026-03-19T08:12:00Z",
    read: true,
    snoozedUntil: null,
  },
  {
    id: "inbox-4",
    agentName: "Quick Think",
    taskTitle: "Design agent memory architecture",
    taskId: "10",
    question: "I've drafted two architecture options: (A) Pinecone vector DB for semantic search + Redis for session state, (B) PostgreSQL with pgvector extension keeping everything in one DB. Option B is simpler but Option A scales better. Which direction?",
    priority: "HIGH",
    timestamp: "2026-03-19T10:30:00Z",
    read: false,
    snoozedUntil: null,
  },
]
