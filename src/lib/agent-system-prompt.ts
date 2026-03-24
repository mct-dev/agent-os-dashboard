/**
 * Modular system prompt builder for agent runs.
 * Each section is an independent function that returns a string or null.
 * Sections are composed via buildAgentSystemPrompt() which joins non-null sections.
 *
 * Inspired by Paperclip's joinPromptSections pattern.
 */

// ── Section Types ──

interface LinearLinkContext {
  teamKey: string
  issueNumber: number
  title: string
  status: string | null
  url: string
}

interface PreviousRunContext {
  model: string
  status: string
  startedAt: string
  prompt: string | null
}

interface CommentContext {
  body: string
  createdAt: string
  isAgent: boolean
}

interface SopStageContext {
  name: string
  role: string
  prompt: string
  sortOrder: number
}

export interface AgentPromptContext {
  // Core
  dashboardUrl: string
  apiKey: string
  taskId: string
  taskTitle: string
  taskDescription: string | null
  agentRunId: string
  // Task metadata
  projectName: string | null
  status: string
  priority: string
  // SOP
  sopName: string | null
  sopDescription: string | null
  sopStages: SopStageContext[]
  // Linked tickets
  linearLinks: LinearLinkContext[]
  // Session history
  previousRuns: PreviousRunContext[]
  // Recent comments (conversation thread)
  recentComments: CommentContext[]
  // Whether this is a resumed session
  isResume: boolean
}

// ── Individual Section Builders ──

export function sectionIdentity(): string {
  return `# Agent OS — System Instructions

You are an autonomous AI agent running inside Agent OS. You execute tasks independently, communicate through comments, and escalate when blocked.

## Core Behavior
- **Work autonomously.** Read the task, make a plan, execute it. Don't wait for permission on routine decisions.
- **Communicate through comments.** The user monitors your progress via the comment feed on your task. Post updates there, not to stdout.
- **Escalate early.** If you're blocked, unsure about requirements, or making a judgment call with significant consequences — post a comment asking for guidance, then stop working on that part.
- **Be thorough but concise.** Do the work well. Keep comments brief and actionable.
- **Leave things better than you found them.** Fix small issues you encounter along the way, but stay focused on the primary task.`
}

export function sectionTaskContext(ctx: Pick<AgentPromptContext, "taskId" | "taskTitle" | "taskDescription" | "projectName" | "status" | "priority">): string {
  const lines = [`## Your Task`, `**${ctx.taskTitle}**`, `Task ID: ${ctx.taskId}`]
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`)
  lines.push(`Status: ${ctx.status} | Priority: ${ctx.priority}`)
  if (ctx.taskDescription) {
    lines.push("", "### Description", ctx.taskDescription)
  }
  return lines.join("\n")
}

export function sectionSop(ctx: Pick<AgentPromptContext, "sopName" | "sopDescription" | "sopStages">): string | null {
  if (!ctx.sopName || ctx.sopStages.length === 0) return null

  const stageLines = ctx.sopStages
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => {
      const lines = [`**Stage ${i + 1}: ${s.name}** (Role: ${s.role})`]
      if (s.prompt) lines.push(s.prompt)
      return lines.join("\n")
    })

  return [
    `## Standard Operating Procedure: ${ctx.sopName}`,
    ctx.sopDescription ? ctx.sopDescription : null,
    "",
    "Follow these stages in order. Complete each stage before moving to the next.",
    "After completing each stage, post a comment noting the stage you've finished.",
    "",
    ...stageLines,
  ].filter((l) => l !== null).join("\n")
}

export function sectionLinearLinks(links: LinearLinkContext[]): string | null {
  if (links.length === 0) return null
  const ticketLines = links.map(
    (l) => `- ${l.teamKey}-${l.issueNumber}: "${l.title}" (${l.status ?? "Unknown"}) — ${l.url}`
  )
  return [
    "## Linked Linear Tickets",
    ...ticketLines,
    "",
    "These tickets provide additional context for your task. If you have Linear MCP access, query them for full details.",
  ].join("\n")
}

export function sectionSessionHandoff(ctx: Pick<AgentPromptContext, "previousRuns" | "isResume">): string | null {
  if (ctx.previousRuns.length === 0) return null
  const runSummaries = ctx.previousRuns.slice(0, 3).map((r) => {
    const promptPreview = r.prompt ? r.prompt.slice(0, 200) + (r.prompt.length > 200 ? "..." : "") : "(no prompt)"
    return `- **${r.status}** (${r.model}, ${r.startedAt}): ${promptPreview}`
  })
  return [
    "## Previous Runs on This Task",
    "This task has been worked on before. Review what was attempted:",
    ...runSummaries,
    "",
    ctx.isResume
      ? "You are **resuming** a previous session. You have access to your prior context. Pick up where you left off."
      : "This is a **new session**. The previous work above is for context only — you're starting fresh.",
  ].join("\n")
}

export function sectionRecentComments(comments: CommentContext[]): string | null {
  if (comments.length === 0) return null
  const commentLines = comments.slice(-10).map((c) => {
    const author = c.isAgent ? "Agent" : "Human"
    return `[${author} · ${c.createdAt}] ${c.body.slice(0, 300)}${c.body.length > 300 ? "..." : ""}`
  })
  return [
    "## Recent Comments",
    "Recent conversation on this task:",
    ...commentLines,
  ].join("\n")
}

export function sectionCommunication(ctx: Pick<AgentPromptContext, "dashboardUrl" | "apiKey" | "taskId" | "agentRunId">): string {
  const base = ctx.dashboardUrl.replace(/\/+$/, "")
  return `## How to Communicate

Post comments on your task using this command:

\`\`\`bash
curl -s -X POST "${base}/api/comments" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${ctx.apiKey}" \\
  -d '{"body": "YOUR MESSAGE", "taskId": "${ctx.taskId}", "agentRunId": "${ctx.agentRunId}"}'
\`\`\`

### When to post a comment:
- **Starting work** — "Starting work. Plan: [1-2 sentences]"
- **Blocked** — "Blocked: [what's wrong]. Need: [what you need from the user]."
- **Key decision** — "Decision: [what you chose and why]. Reply if you disagree."
- **Done** — "Done. Summary: [what was accomplished]. Follow-up: [anything remaining]."
- **Error** — "Error encountered: [description]. Attempted: [what you tried]."
- **Stage complete** — "Completed stage N: [stage name]. Moving to stage N+1."

### Comment guidelines:
- Keep comments short — 1-3 sentences is ideal
- Use comments for communication, not for logging. Your tool output is already recorded.
- If you need human input, say so explicitly and **stop working on that part** until you get a response.
- Don't post a comment for every file you edit. Summarize at milestones.`
}

// ── Composer ──

export function buildAgentSystemPrompt(ctx: AgentPromptContext): string {
  const sections = [
    sectionIdentity(),
    sectionTaskContext(ctx),
    sectionSop(ctx),
    sectionLinearLinks(ctx.linearLinks),
    sectionSessionHandoff(ctx),
    sectionRecentComments(ctx.recentComments),
    sectionCommunication(ctx),
  ].filter((s): s is string => s !== null)

  return sections.join("\n\n---\n\n")
}
