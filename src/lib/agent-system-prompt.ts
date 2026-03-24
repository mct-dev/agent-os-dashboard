/**
 * Builds a multi-section system prompt for agent runs.
 * Modeled after Paperclip's joinPromptSections pattern:
 * instructions + task context + session handoff + communication tools
 */

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
  // Linked tickets
  linearLinks: LinearLinkContext[]
  // Session history
  previousRuns: PreviousRunContext[]
  // Recent comments (conversation thread)
  recentComments: CommentContext[]
  // Whether this is a resumed session
  isResume: boolean
}

export function buildAgentSystemPrompt(ctx: AgentPromptContext): string {
  const sections: string[] = []
  const base = ctx.dashboardUrl.replace(/\/+$/, "")

  // ── Section 1: Identity & Behavior ──
  sections.push(`# Agent OS — System Instructions

You are an autonomous AI agent running inside Agent OS. You execute tasks independently, communicate through comments, and escalate when blocked.

## Core Behavior
- **Work autonomously.** Read the task, make a plan, execute it. Don't wait for permission on routine decisions.
- **Communicate through comments.** The user monitors your progress via the comment feed on your task. Post updates there, not to stdout.
- **Escalate early.** If you're blocked, unsure about requirements, or making a judgment call with significant consequences — post a comment asking for guidance, then stop working on that part.
- **Be thorough but concise.** Do the work well. Keep comments brief and actionable.
- **Leave things better than you found them.** Fix small issues you encounter along the way, but stay focused on the primary task.`)

  // ── Section 2: Task Context ──
  const taskLines = [`## Your Task`, `**${ctx.taskTitle}**`, `Task ID: ${ctx.taskId}`]
  if (ctx.projectName) taskLines.push(`Project: ${ctx.projectName}`)
  taskLines.push(`Status: ${ctx.status} | Priority: ${ctx.priority}`)
  if (ctx.taskDescription) {
    taskLines.push("", "### Description", ctx.taskDescription)
  }
  sections.push(taskLines.join("\n"))

  // ── Section 3: Linked Linear Tickets ──
  if (ctx.linearLinks.length > 0) {
    const ticketLines = ctx.linearLinks.map(
      (l) => `- ${l.teamKey}-${l.issueNumber}: "${l.title}" (${l.status ?? "Unknown"}) — ${l.url}`
    )
    sections.push([
      "## Linked Linear Tickets",
      ...ticketLines,
      "",
      "These tickets provide additional context for your task. If you have Linear MCP access, query them for full details.",
    ].join("\n"))
  }

  // ── Section 4: Session Handoff (previous runs) ──
  if (ctx.previousRuns.length > 0) {
    const runSummaries = ctx.previousRuns.slice(0, 3).map((r) => {
      const promptPreview = r.prompt ? r.prompt.slice(0, 200) + (r.prompt.length > 200 ? "..." : "") : "(no prompt)"
      return `- **${r.status}** (${r.model}, ${r.startedAt}): ${promptPreview}`
    })
    sections.push([
      "## Previous Runs on This Task",
      "This task has been worked on before. Review what was attempted:",
      ...runSummaries,
      "",
      ctx.isResume
        ? "You are **resuming** a previous session. You have access to your prior context. Pick up where you left off."
        : "This is a **new session**. The previous work above is for context only — you're starting fresh.",
    ].join("\n"))
  }

  // ── Section 5: Recent Comments (conversation thread) ──
  if (ctx.recentComments.length > 0) {
    const commentLines = ctx.recentComments.slice(-10).map((c) => {
      const author = c.isAgent ? "Agent" : "Human"
      return `[${author} · ${c.createdAt}] ${c.body.slice(0, 300)}${c.body.length > 300 ? "..." : ""}`
    })
    sections.push([
      "## Recent Comments",
      "Recent conversation on this task:",
      ...commentLines,
    ].join("\n"))
  }

  // ── Section 6: Communication Tools ──
  sections.push(`## How to Communicate

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

### Comment guidelines:
- Keep comments short — 1-3 sentences is ideal
- Use comments for communication, not for logging. Your tool output is already recorded.
- If you need human input, say so explicitly and **stop working on that part** until you get a response.
- Don't post a comment for every file you edit. Summarize at milestones.`)

  return sections.join("\n\n---\n\n")
}
