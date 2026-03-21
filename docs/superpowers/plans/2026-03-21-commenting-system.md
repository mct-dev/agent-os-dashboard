# Commenting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a commenting system with @-agent mentions that trigger automated agent responses via the bridge.

**Architecture:** Polymorphic Comment model on tasks/projects/runs. POST handler parses @-mentions, dispatches bridge runs. Bridge calls a completion webhook that auto-posts agent replies. Flat chronological CommentThread component with @-autocomplete.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL (Supabase), React 19, DaisyUI, react-markdown + rehype-sanitize, sonner (toasts)

**Spec:** `docs/superpowers/specs/2026-03-21-commenting-system-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `prisma/migrations/20260321_add_comments/migration.sql` | DB migration |
| `src/app/api/comments/route.ts` | GET (list) + POST (create with @-mention parsing) |
| `src/app/api/comments/[id]/route.ts` | PUT (edit) + DELETE |
| `src/app/api/runs/callback/complete/route.ts` | Completion webhook — auto-posts agent replies |
| `src/components/comment-thread.tsx` | CommentThread + CommentInput + MentionAutocomplete |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Comment model, make AgentRun.taskId nullable, add triggerCommentId, unique AgentConfig.name |
| `src/lib/types.ts` | Add Comment interface |
| `src/lib/api-client.ts` | Add fetchComments, createComment, updateComment, deleteComment |
| `src/lib/api-helpers.ts` | Add serializeComment helper |
| `src/components/task-panel.tsx` | Add CommentThread section below run history |
| `src/components/projects-page.tsx` | Add CommentThread to project cards or detail view |
| `src/app/api/tasks/route.ts` | Accept status field in POST (already done), handle nullable taskId on runs |
| `bridge/src/index.ts` | Add `callback_url` support to POST /api/runs |
| `bridge/src/claude-adapter.ts` | Call callback_url on run completion |
| `package.json` | Add react-markdown, rehype-sanitize |

---

## Task 1: Database — Schema & Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260321_add_comments/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add the Comment model and modify existing models. In `prisma/schema.prisma`:

```prisma
model Comment {
  id          String    @id @default(cuid())
  body        String

  taskId      String?
  task        Task?     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  projectId   String?
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agentRunId  String?
  agentRun    AgentRun? @relation("RunComments", fields: [agentRunId], references: [id], onDelete: Cascade)

  userId      String?
  agentId     String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  triggeredRuns AgentRun[] @relation("TriggeredByComment")

  @@index([taskId])
  @@index([projectId])
  @@index([agentRunId])
}
```

On the `Task` model, add: `comments Comment[]`

On the `Project` model, add: `comments Comment[]`

On the `AgentRun` model:
- Change `taskId String` to `taskId String?` and `task Task` to `task Task?`
- Add `triggerCommentId String?`
- Add `triggerComment Comment? @relation("TriggeredByComment", fields: [triggerCommentId], references: [id], onDelete: SetNull)`
- Add `agentConfigId String?` (tracks which agent was dispatched for this run)
- Add `comments Comment[] @relation("RunComments")`

On the `AgentConfig` model, add `@unique` to `name`:
```prisma
name String @unique
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260321_add_comments/migration.sql`:

```sql
-- Make AgentRun.taskId nullable
ALTER TABLE "AgentRun" ALTER COLUMN "taskId" DROP NOT NULL;

-- Add trigger comment link and agent identity to AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "triggerCommentId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "agentConfigId" TEXT;

-- Add unique constraint on AgentConfig.name
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_name_key" UNIQUE ("name");

-- Create Comment table
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "agentRunId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");
CREATE INDEX "Comment_agentRunId_idx" ON "Comment"("agentRunId");

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_triggerCommentId_fkey"
    FOREIGN KEY ("triggerCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_parent"
    CHECK (num_nonnulls("taskId", "projectId", "agentRunId") = 1);
ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_author"
    CHECK (num_nonnulls("userId", "agentId") = 1);
```

- [ ] **Step 3: Apply migration to production DB**

```bash
export $(grep -v '^#' .env.local | xargs)
npx prisma db execute --url "$DATABASE_URL" --file prisma/migrations/20260321_add_comments/migration.sql
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Comment model and migration"
```

---

## Task 2: Types & API Client

**Files:**
- Modify: `src/lib/types.ts` (add Comment interface)
- Modify: `src/lib/api-client.ts` (add comment CRUD functions)
- Modify: `src/lib/api-helpers.ts` (add serializeComment)

- [ ] **Step 1: Add Comment type to types.ts**

After the `AgentConfig` interface (~line 63), add:

```typescript
export interface Comment {
  id: string
  body: string
  taskId: string | null
  projectId: string | null
  agentRunId: string | null
  userId: string | null
  agentId: string | null
  createdAt: string
  updatedAt: string
  triggeredRuns?: { id: string; status: RunStatus }[]
}
```

Also update the `AgentRun` interface to include the new fields:

```typescript
// Add to AgentRun interface:
output: string | null
triggerCommentId: string | null
agentConfigId: string | null
```

- [ ] **Step 2: Add comment API functions to api-client.ts**

After the inbox section (~line 238), add:

```typescript
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
```

Add `Comment` to the import from `"./types"`.

- [ ] **Step 3: Add serializeComment to api-helpers.ts**

After `serializeTask`, add:

```typescript
type CommentWithRuns = PrismaComment & { triggeredRuns?: { id: string; status: string }[] }

export function serializeComment(comment: CommentWithRuns) {
  return {
    ...comment,
    triggeredRuns: comment.triggeredRuns ?? [],
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}
```

Add `Comment as PrismaComment` to the Prisma imports.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts src/lib/api-helpers.ts
git commit -m "feat: add Comment types, API client, and serializer"
```

---

## Task 3: Comment API Routes (CRUD)

**Files:**
- Create: `src/app/api/comments/route.ts`
- Create: `src/app/api/comments/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `src/app/api/comments/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authenticate, serializeComment } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskId = req.nextUrl.searchParams.get("taskId")
  const projectId = req.nextUrl.searchParams.get("projectId")
  const agentRunId = req.nextUrl.searchParams.get("agentRunId")

  const where: Record<string, string> = {}
  if (taskId) where.taskId = taskId
  else if (projectId) where.projectId = projectId
  else if (agentRunId) where.agentRunId = agentRunId
  else return NextResponse.json({ error: "Provide taskId, projectId, or agentRunId" }, { status: 400 })

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  return NextResponse.json(comments.map(serializeComment))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const apiKey = req.headers.get("x-api-key")
  const isApiKey = apiKey && apiKey === process.env.ICARUS_API_KEY

  if (!session?.user?.email && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 })
  }

  const parentCount = [body.taskId, body.projectId, body.agentRunId].filter(Boolean).length
  if (parentCount !== 1) {
    return NextResponse.json({ error: "Provide exactly one of taskId, projectId, or agentRunId" }, { status: 400 })
  }

  // Determine author
  const userId = session?.user?.email ?? null
  const agentId = body.agentId ?? null
  if (!userId && !agentId) {
    return NextResponse.json({ error: "Could not determine author" }, { status: 400 })
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body,
      taskId: body.taskId ?? null,
      projectId: body.projectId ?? null,
      agentRunId: body.agentRunId ?? null,
      userId: agentId ? null : userId,
      agentId: agentId ?? null,
    },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  // Parse @-mentions and trigger agent runs (async, don't block response)
  parseMentionsAndTrigger(comment.id, body.body, {
    taskId: body.taskId,
    projectId: body.projectId,
    agentRunId: body.agentRunId,
  }).catch((err) => console.error("Mention trigger failed:", err))

  return NextResponse.json(serializeComment(comment), { status: 201 })
}

async function parseMentionsAndTrigger(
  commentId: string,
  text: string,
  parent: { taskId?: string; projectId?: string; agentRunId?: string }
) {
  const re = /\B@([^\s@,!?.]+)/g
  const tokens = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) tokens.add(m[1].toLowerCase())
  if (tokens.size === 0) return

  const agents = await prisma.agentConfig.findMany()
  const matched = agents.filter((a) => tokens.has(a.name.toLowerCase()))
  if (matched.length === 0) return

  // Get user settings for bridge URL
  const settings = await prisma.userSettings.findFirst()
  if (!settings?.bridgeUrl) return

  // Build comment thread context
  const where: Record<string, string> = {}
  if (parent.taskId) where.taskId = parent.taskId
  else if (parent.projectId) where.projectId = parent.projectId
  else if (parent.agentRunId) where.agentRunId = parent.agentRunId

  const threadComments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
  })

  const threadText = threadComments
    .map((c) => `[${c.agentId ?? c.userId ?? "unknown"}] ${c.body}`)
    .join("\n\n")

  // Get parent context for the prompt
  let parentContext = ""
  if (parent.taskId) {
    const task = await prisma.task.findUnique({ where: { id: parent.taskId } })
    if (task) parentContext = `Task "${task.title}": ${task.description ?? "No description"}`
  } else if (parent.projectId) {
    const project = await prisma.project.findUnique({ where: { id: parent.projectId } })
    if (project) parentContext = `Project "${project.name}"`
  }

  // Dispatch a run for each mentioned agent
  const callbackBase = process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  for (const agent of matched) {
    const prompt = [
      `You are ${agent.name}. ${agent.systemPrompt}`,
      "",
      parentContext ? `Context: ${parentContext}` : "",
      "",
      "Comment thread:",
      threadText,
      "",
      "Respond to the mention. Be concise and helpful.",
    ].filter(Boolean).join("\n")

    try {
      const bridgeRes = await fetch(`${settings.bridgeUrl.replace(/\/+$/, "")}/api/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.bridgeApiKey ?? "",
        },
        body: JSON.stringify({
          task_id: parent.taskId ?? `comment-${commentId}`,
          task_title: parentContext || "Comment reply",
          prompt,
          model: agent.model,
          callback_url: `${callbackBase}/api/runs/callback/complete`,
          callback_api_key: process.env.ICARUS_API_KEY ?? "",
        }),
      })

      if (!bridgeRes.ok) continue
      const { runId: bridgeRunId } = await bridgeRes.json()

      // Create AgentRun in dashboard DB
      await prisma.agentRun.create({
        data: {
          taskId: parent.taskId ?? null,
          bridgeRunId,
          status: "RUNNING",
          model: agent.model,
          prompt,
          triggerCommentId: commentId,
          agentConfigId: agent.id,
        },
      })
    } catch (err) {
      console.error(`Failed to dispatch run for agent ${agent.name}:`, err)
    }
  }
}
```

- [ ] **Step 2: Create PUT + DELETE route**

Create `src/app/api/comments/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { serializeComment } from "@/lib/api-helpers"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.email) return null
  return session
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }
  if (existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Can only edit own comments" }, { status: 403 })
  }

  const comment = await prisma.comment.update({
    where: { id },
    data: { body: body.body },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  return NextResponse.json(serializeComment(comment))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }
  if (existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Can only delete own comments" }, { status: 403 })
  }

  await prisma.comment.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/comments/
git commit -m "feat: add comment API routes with @-mention parsing"
```

---

## Task 4: Completion Webhook

**Files:**
- Create: `src/app/api/runs/callback/complete/route.ts`
- Modify: `bridge/src/index.ts` (add callback_url support)
- Modify: `bridge/src/claude-adapter.ts` (call callback on completion)

- [ ] **Step 1: Create the completion webhook route**

Create `src/app/api/runs/callback/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  // Accept either the dashboard API key or a key passed in the callback payload
  const apiKey = req.headers.get("x-api-key")
  const body = await req.json()
  const { bridgeRunId, status, output, api_key } = body

  // Auth: accept ICARUS_API_KEY from header or body (bridge sends it via body)
  const validKey = process.env.ICARUS_API_KEY
  if (apiKey !== validKey && api_key !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!bridgeRunId || !status) {
    return NextResponse.json({ error: "bridgeRunId and status required" }, { status: 400 })
  }

  // Find the AgentRun by bridgeRunId
  const run = await prisma.agentRun.findFirst({
    where: { bridgeRunId },
  })

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // Update the run
  const mappedStatus = status === "completed" ? "COMPLETED"
    : status === "failed" ? "FAILED"
    : status === "stopped" ? "STOPPED"
    : status.toUpperCase()

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: mappedStatus,
      output: output ?? null,
      endedAt: new Date(),
    },
  })

  // If this run was triggered by a comment, auto-post reply
  if (run.triggerCommentId && output && mappedStatus === "COMPLETED") {
    const triggerComment = await prisma.comment.findUnique({
      where: { id: run.triggerCommentId },
    })

    if (triggerComment) {
      await prisma.comment.create({
        data: {
          body: output.trim(),
          taskId: triggerComment.taskId,
          projectId: triggerComment.projectId,
          agentRunId: triggerComment.agentRunId,
          userId: null,
          agentId: run.agentConfigId ?? run.model, // agentConfigId set during dispatch
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add callback_url support to bridge POST /api/runs**

In `bridge/src/index.ts`, update the POST /api/runs handler. Add `callback_url` to the destructured body (~line 33):

```typescript
const {
  task_id, task_title, task_description, sop_id,
  prompt, model, adapter = "claude", cwd,
  callback_url,       // NEW
  callback_api_key,   // NEW — dashboard API key for auth on callback
} = req.body
```

Pass both through to `spawnClaudeRun`:

```typescript
spawnClaudeRun({
  id, task_id, task_title: task_title ?? "",
  task_description, prompt, model, cwd,
  callback_url,       // NEW
  callback_api_key,   // NEW
}).catch((err) => { ... })
```

- [ ] **Step 3: Call callback_url on run completion in claude-adapter.ts**

At the end of `spawnClaudeRun`, after updating the run status in the bridge DB (~line 81-84), add:

```typescript
// Call callback URL if provided
if (callback_url) {
  try {
    await fetch(callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bridgeRunId: id,
        status: exitCode === 0 ? "completed" : "failed",
        output: finalOutput ?? null,
        api_key: callback_api_key ?? "",  // dashboard API key, passed through from dispatch
      }),
    })
  } catch (err) {
    console.error(`Callback failed for run ${id}:`, err)
  }
}
```

Note: `finalOutput` needs to be captured from the process stdout. The current `spawnClaudeRun` streams output via WebSocket but doesn't accumulate it. Add a buffer to capture the full output:

```typescript
let finalOutput = ""
// Inside the runChildProcess onLog callback:
if (stream === "stdout") finalOutput += chunk
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/runs/callback/ bridge/src/
git commit -m "feat: add completion webhook and bridge callback support"
```

---

## Task 5: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-markdown and rehype-sanitize**

```bash
npm install react-markdown rehype-sanitize
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and rehype-sanitize"
```

---

## Task 6: CommentThread UI Component

**Files:**
- Create: `src/components/comment-thread.tsx`

- [ ] **Step 1: Create the CommentThread component**

Create `src/components/comment-thread.tsx`:

```tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useAppState } from "@/lib/store"
import { fetchComments, createComment } from "@/lib/api-client"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import type { Comment } from "@/lib/types"

interface CommentThreadProps {
  taskId?: string
  projectId?: string
  agentRunId?: string
}

export function CommentThread({ taskId, projectId, agentRunId }: CommentThreadProps) {
  const { agents } = useAppState()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchComments({ taskId, projectId, agentRunId })
      setComments(data)
    } catch {
      // silent — don't toast on poll failures
    } finally {
      setLoading(false)
    }
  }, [taskId, projectId, agentRunId])

  useEffect(() => {
    loadComments()
    const interval = setInterval(loadComments, 5000)
    return () => clearInterval(interval)
  }, [loadComments])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length])

  const getAuthorName = (comment: Comment) => {
    if (comment.agentId) {
      const agent = agents.find((a) => a.id === comment.agentId)
      return agent?.name ?? "Agent"
    }
    return comment.userId ?? "User"
  }

  const hasRunningTrigger = (comment: Comment) =>
    comment.triggeredRuns?.some((r) => r.status === "RUNNING" || r.status === "PENDING") ?? false

  if (loading) {
    return <div className="text-xs text-base-content/40 py-4 text-center">Loading comments...</div>
  }

  return (
    <div className="flex flex-col">
      {/* Comment list */}
      <div className="space-y-3 mb-3 max-h-[400px] overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-base-content/30 text-center py-4">No comments yet</p>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              comment.agentId
                ? "bg-primary/5 border border-primary/10"
                : "bg-base-200"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs">
                {comment.agentId ? "🤖" : "👤"}
              </span>
              <span className="text-xs font-medium text-base-content/70">
                {getAuthorName(comment)}
              </span>
              <span className="text-[10px] text-base-content/30 ml-auto">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="prose prose-sm max-w-none text-base-content/80 [&_p]:m-0 [&_p]:text-sm">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {comment.body}
              </ReactMarkdown>
            </div>
            {hasRunningTrigger(comment) && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="loading loading-dots loading-xs text-primary" />
                <span className="text-[10px] text-base-content/40">Agent thinking...</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Comment input */}
      <CommentInput
        taskId={taskId}
        projectId={projectId}
        agentRunId={agentRunId}
        onCommentAdded={(comment) => {
          setComments((prev) => [...prev, comment])
        }}
      />
    </div>
  )
}

function CommentInput({
  taskId,
  projectId,
  agentRunId,
  onCommentAdded,
}: {
  taskId?: string
  projectId?: string
  agentRunId?: string
  onCommentAdded: (comment: Comment) => void
}) {
  const { agents } = useAppState()
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  const handleInput = (value: string) => {
    setBody(value)

    // Check for @-mention trigger
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart
    const textBefore = value.slice(0, cursor)
    const atMatch = textBefore.match(/@([^\s@]*)$/)

    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (agentName: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart
    const textBefore = body.slice(0, cursor)
    const textAfter = body.slice(cursor)
    const atIndex = textBefore.lastIndexOf("@")
    const newBody = textBefore.slice(0, atIndex) + `@${agentName} ` + textAfter
    setBody(newBody)
    setShowMentions(false)
    textarea.focus()
  }

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    try {
      const comment = await createComment({
        body: body.trim(),
        taskId,
        projectId,
        agentRunId,
      })
      onCommentAdded(comment)
      setBody("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment")
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      setShowMentions(false)
    }
  }

  return (
    <div className="relative">
      {/* @-mention dropdown */}
      {showMentions && filteredAgents.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10 max-h-[150px] overflow-y-auto">
          {filteredAgents.map((agent) => (
            <button
              key={agent.id}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-base-200 flex items-center gap-2"
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(agent.name)
              }}
            >
              <span>🤖</span>
              <span>{agent.name}</span>
              <span className="text-base-content/30 ml-auto">{agent.model}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (@ to mention an agent)"
          className="textarea textarea-bordered textarea-sm flex-1 min-h-[60px] resize-none text-sm"
          rows={2}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          className="self-end"
        >
          Send
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/comment-thread.tsx
git commit -m "feat: add CommentThread UI with @-mention autocomplete"
```

---

## Task 7: Integrate CommentThread into TaskPanel

**Files:**
- Modify: `src/components/task-panel.tsx`

- [ ] **Step 1: Add CommentThread section to TaskPanel**

In `task-panel.tsx`, add the import at the top:

```typescript
import { CommentThread } from "@/components/comment-thread"
```

After the "Run History" section (after the closing `</div>` of the run history section, ~line 429), add:

```tsx
{/* Comments */}
<div className="px-4 pb-6">
  <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
    Comments
  </h3>
  <CommentThread taskId={task.id} />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task-panel.tsx
git commit -m "feat: integrate CommentThread into TaskPanel"
```

---

## Task 8: Add Run-Level Comments in TaskPanel

**Files:**
- Modify: `src/components/task-panel.tsx`

- [ ] **Step 1: Add collapsible CommentThread per completed run**

In the run history section of `task-panel.tsx`, after each run's status/cost display, add a collapsible comment section. For runs with status COMPLETED or FAILED, add:

```tsx
<details className="mt-2">
  <summary className="text-[10px] text-base-content/40 cursor-pointer hover:text-base-content/60">
    Comments
  </summary>
  <div className="mt-2">
    <CommentThread agentRunId={run.id} />
  </div>
</details>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task-panel.tsx
git commit -m "feat: add run-level comments in task panel"
```

---

## Task 9: Integrate CommentThread into ProjectsPage

**Files:**
- Modify: `src/components/projects-page.tsx`

- [ ] **Step 1: Add CommentThread to project cards**

Import CommentThread:

```typescript
import { CommentThread } from "@/components/comment-thread"
```

Add a `commentProjectId` state variable:

```typescript
const [commentProjectId, setCommentProjectId] = useState<string | null>(null)
```

On each project card, add a "Comments" button that toggles the comment section. Replace the existing `onClick={() => openEdit(project)}` on the card with a more targeted edit button, and add a separate comments toggle:

```tsx
<div className="flex items-center gap-2 mt-2">
  <button
    className="text-[10px] text-base-content/40 hover:text-base-content/60"
    onClick={(e) => {
      e.stopPropagation()
      setCommentProjectId(commentProjectId === project.id ? null : project.id)
    }}
  >
    {commentProjectId === project.id ? "Hide comments" : "Comments"}
  </button>
</div>
{commentProjectId === project.id && (
  <div className="mt-3 pt-3 border-t border-base-300">
    <CommentThread projectId={project.id} />
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/projects-page.tsx
git commit -m "feat: add CommentThread to projects page"
```

---

## Task 10: Deploy & Verify

- [ ] **Step 1: Push to branch and create PR**

```bash
git push origin feat/commenting-system
```

Create PR via `gh pr create`.

- [ ] **Step 2: Apply migration to production**

```bash
export $(grep -v '^#' .env.local | xargs)
npx prisma db execute --url "$DATABASE_URL" --file prisma/migrations/20260321_add_comments/migration.sql
```

- [ ] **Step 3: Verify in UI**

After Vercel deployment completes:
1. Open the board, click a task — verify CommentThread appears below run history
2. Post a comment — verify it appears in the thread
3. Type `@` — verify agent autocomplete dropdown appears
4. Post a comment with `@AgentName` — verify "Agent thinking..." indicator shows
5. Navigate to Projects — verify comment section appears
6. Edit and delete a comment — verify both work

- [ ] **Step 4: Verify API via curl**

```bash
# Create comment
curl -s $URL/api/comments -H "x-api-key: $KEY" -H "Content-Type: application/json" \
  -d '{"body":"Test comment","taskId":"<task-id>"}'

# List comments
curl -s "$URL/api/comments?taskId=<task-id>" -H "x-api-key: $KEY"
```
