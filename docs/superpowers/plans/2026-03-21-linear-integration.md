# Linear Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to connect their Linear account, import Linear issues as agent-os tasks, link/unlink Linear tickets to tasks, and auto-inject Linear context into agent prompts.

**Architecture:** New `LinearLink` Prisma model with one-to-many relationship to Task. Linear API calls proxied server-side through Next.js API routes using the user's stored API key. Lightweight link data eagerly loaded with tasks for kanban badge display. Agent context injection happens in the runs API route before dispatching to bridge.

**Tech Stack:** Next.js 16, React 19, Prisma 6 (PostgreSQL/Supabase), `@linear/sdk` for Linear GraphQL API, shadcn/ui + DaisyUI for components, sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-03-21-linear-integration-design.md`

---

## File Map

### New Files
- `prisma/migrations/<timestamp>_add_linear_link/migration.sql` — DB migration
- `src/app/api/linear/status/route.ts` — Check Linear connection
- `src/app/api/linear/connect/route.ts` — Save Linear API key
- `src/app/api/linear/teams/route.ts` — List Linear teams
- `src/app/api/linear/search/route.ts` — Search Linear issues
- `src/app/api/linear/import/route.ts` — Bulk import Linear issues as tasks
- `src/app/api/tasks/[id]/linear-links/route.ts` — List + create links
- `src/app/api/tasks/[id]/linear-links/[linkId]/route.ts` — Delete link
- `src/app/api/tasks/[id]/linear-links/sync/route.ts` — Refresh link data
- `src/lib/linear-client.ts` — Server-side Linear API helper
- `src/components/linear-search-modal.tsx` — Shared search/browse modal
- `src/components/linear-import-modal.tsx` — Import flow modal (wraps search)
- `src/components/linear-link-section.tsx` — Task panel linked issues section
- `src/components/linear-icon.tsx` — Linear logomark SVG component

### Modified Files
- `prisma/schema.prisma` — Add LinearLink model, linearApiKey to UserSettings
- `src/lib/types.ts` — Add LinearLink type
- `src/lib/api-client.ts` — Add Linear API client functions
- `src/lib/store.ts` — Add linearConnected state
- `src/lib/api-helpers.ts` — Update serializeTask to include linearLinks
- `src/app/api/runs/route.ts` — Inject Linear context into prompt
- `src/app/api/tasks/route.ts` — Include linearLinks in task queries
- `src/app/api/tasks/[id]/route.ts` — Include linearLinks in task queries
- `src/components/settings-page.tsx` — Add Linear connection section
- `src/components/kanban-board.tsx` — Add import button in header
- `src/components/task-card.tsx` — Add hybrid Linear badge
- `src/components/task-panel.tsx` — Add linked issues section
- `package.json` — Add `@linear/sdk` dependency

---

## Task 1: Database Schema & Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `package.json`
- Create: migration via `npx prisma migrate dev`

- [ ] **Step 1: Install Linear SDK**

```bash
npm install @linear/sdk
```

- [ ] **Step 2: Add LinearLink model and linearApiKey to schema**

In `prisma/schema.prisma`, add `linearApiKey` to UserSettings (after `bridgeName`):

```prisma
  linearApiKey   String?
```

Add LinearLink model after UserSettings:

```prisma
model LinearLink {
  id                 String   @id @default(cuid())
  taskId             String
  task               Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  linearIssueId      String
  linearIssueUrl     String
  linearTeamKey      String
  linearIssueNumber  Int
  linearTitle        String
  linearStatus       String?
  linearPriority     Int?
  linearAssignee     String?
  syncedAt           DateTime @default(now())
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([taskId, linearIssueId])
}
```

Add `linearLinks LinearLink[]` relation to the Task model (after the `comments` relation).

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add_linear_link
```

- [ ] **Step 4: Verify migration applied**

```bash
npx prisma studio
```

Check that LinearLink table exists and UserSettings has linearApiKey column.

- [ ] **Step 5: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add LinearLink model and linearApiKey to schema"
```

---

## Task 2: Linear Icon Component

**Files:**
- Create: `src/components/linear-icon.tsx`

- [ ] **Step 1: Create the Linear icon component**

```tsx
export function LinearIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      aria-label="Linear"
    >
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465915 2.2686-.77832 4.5932-.92588465 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3367c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1855ZM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z" />
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/linear-icon.tsx
git commit -m "feat: add Linear logomark icon component"
```

---

## Task 3: Types & API Client

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api-client.ts`

- [ ] **Step 1: Add LinearLink type**

In `src/lib/types.ts`, add after the `Comment` interface:

```typescript
export interface LinearLink {
  id: string
  taskId: string
  linearIssueId: string
  linearIssueUrl: string
  linearTeamKey: string
  linearIssueNumber: number
  linearTitle: string
  linearStatus: string | null
  linearPriority: number | null
  linearAssignee: string | null
  syncedAt: string
  createdAt: string
  updatedAt: string
}

export interface LinearSearchResult {
  id: string
  identifier: string
  title: string
  description: string | null
  url: string
  status: string
  priority: number
  assignee: string | null
  team: { key: string }
  number: number
}

export interface LinearTeam {
  id: string
  name: string
  key: string
}
```

Add `linearLinks?: LinearLink[]` to the `Task` interface.

- [ ] **Step 2: Add Linear API client functions**

In `src/lib/api-client.ts`, add at the end:

```typescript
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
```

Add `LinearLink, LinearSearchResult, LinearTeam` to imports from types.ts at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/api-client.ts
git commit -m "feat: add Linear types and API client functions"
```

---

## Task 4: Server-Side Linear Client

**Files:**
- Create: `src/lib/linear-client.ts`

- [ ] **Step 1: Create Linear API helper**

```typescript
import { LinearClient } from "@linear/sdk"
import { prisma } from "./prisma"
import { auth } from "./auth"

export async function getLinearClient(): Promise<LinearClient | null> {
  const session = await auth()
  if (!session?.user?.email) return null

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })
  if (!settings?.linearApiKey) return null

  return new LinearClient({ apiKey: settings.linearApiKey })
}

export async function validateLinearKey(apiKey: string): Promise<{ valid: boolean; workspace?: string; email?: string }> {
  try {
    const client = new LinearClient({ apiKey })
    const viewer = await client.viewer
    const org = await client.organization
    return { valid: true, workspace: org.name, email: viewer.email }
  } catch {
    return { valid: false }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/linear-client.ts
git commit -m "feat: add server-side Linear API client helper"
```

---

## Task 5: Linear Connection API Routes

**Files:**
- Create: `src/app/api/linear/status/route.ts`
- Create: `src/app/api/linear/connect/route.ts`

- [ ] **Step 1: Create status route**

```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateLinearKey } from "@/lib/linear-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.linearApiKey) {
    return NextResponse.json({ connected: false })
  }

  const result = await validateLinearKey(settings.linearApiKey)
  if (!result.valid) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({ connected: true, workspace: result.workspace, email: result.email })
}
```

- [ ] **Step 2: Create connect route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateLinearKey } from "@/lib/linear-client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { apiKey } = await req.json()
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key required" }, { status: 400 })
  }

  const result = await validateLinearKey(apiKey)
  if (!result.valid) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 })
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.email },
    update: { linearApiKey: apiKey },
    create: { userId: session.user.email, linearApiKey: apiKey },
  })

  return NextResponse.json({ connected: true, workspace: result.workspace, email: result.email })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/linear/status/route.ts src/app/api/linear/connect/route.ts
git commit -m "feat: add Linear connection status and connect API routes"
```

---

## Task 6: Linear Search & Teams API Routes

**Files:**
- Create: `src/app/api/linear/teams/route.ts`
- Create: `src/app/api/linear/search/route.ts`

- [ ] **Step 1: Create teams route**

```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLinearClient } from "@/lib/linear-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const teams = await client.teams()
  const result = teams.nodes.map((t) => ({
    id: t.id,
    name: t.name,
    key: t.key,
  }))

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Create search route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLinearClient } from "@/lib/linear-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const q = req.nextUrl.searchParams.get("q") || ""
  const teamId = req.nextUrl.searchParams.get("teamId")

  const filter: Record<string, unknown> = {}
  if (teamId) filter.team = { id: { eq: teamId } }

  let issues
  if (q.trim()) {
    issues = await client.issueSearch(q, { filter, first: 50 })
  } else {
    issues = await client.issues({ filter, first: 50 })
  }

  const results = await Promise.all(
    issues.nodes.map(async (issue) => {
      const state = await issue.state
      const assignee = await issue.assignee
      const team = await issue.team
      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        status: state?.name ?? "Unknown",
        priority: issue.priority,
        assignee: assignee?.name ?? null,
        team: { key: team?.key ?? "" },
        number: issue.number,
      }
    })
  )

  return NextResponse.json(results)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/linear/teams/route.ts src/app/api/linear/search/route.ts
git commit -m "feat: add Linear teams and search API routes"
```

---

## Task 7: LinearLink CRUD API Routes

**Files:**
- Create: `src/app/api/tasks/[id]/linear-links/route.ts`
- Create: `src/app/api/tasks/[id]/linear-links/[linkId]/route.ts`
- Create: `src/app/api/tasks/[id]/linear-links/sync/route.ts`

- [ ] **Step 1: Create list + create route**

`src/app/api/tasks/[id]/linear-links/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"
import { getLinearClient } from "@/lib/linear-client"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const links = await prisma.linearLink.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(links)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const { linearIssueId } = await req.json()

  if (!linearIssueId) {
    return NextResponse.json({ error: "linearIssueId required" }, { status: 400 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const issue = await client.issue(linearIssueId)
  const state = await issue.state
  const assignee = await issue.assignee
  const team = await issue.team

  const link = await prisma.linearLink.create({
    data: {
      taskId: id,
      linearIssueId: issue.id,
      linearIssueUrl: issue.url,
      linearTeamKey: team?.key ?? "",
      linearIssueNumber: issue.number,
      linearTitle: issue.title,
      linearStatus: state?.name ?? null,
      linearPriority: issue.priority,
      linearAssignee: assignee?.name ?? null,
      syncedAt: new Date(),
    },
  })

  return NextResponse.json(link, { status: 201 })
}
```

- [ ] **Step 2: Create delete route**

`src/app/api/tasks/[id]/linear-links/[linkId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id, linkId } = await params

  await prisma.linearLink.deleteMany({
    where: { id: linkId, taskId: id },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create sync route**

`src/app/api/tasks/[id]/linear-links/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"
import { getLinearClient } from "@/lib/linear-client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const links = await prisma.linearLink.findMany({ where: { taskId: id } })

  const updated = await Promise.all(
    links.map(async (link) => {
      try {
        const issue = await client.issue(link.linearIssueId)
        const state = await issue.state
        const assignee = await issue.assignee
        return prisma.linearLink.update({
          where: { id: link.id },
          data: {
            linearTitle: issue.title,
            linearStatus: state?.name ?? null,
            linearPriority: issue.priority,
            linearAssignee: assignee?.name ?? null,
            syncedAt: new Date(),
          },
        })
      } catch {
        return link
      }
    })
  )

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tasks/[id]/linear-links/
git commit -m "feat: add LinearLink CRUD and sync API routes"
```

---

## Task 8: Update Task Queries to Include LinearLinks

**Files:**
- Modify: `src/lib/api-helpers.ts` — Update serializeTask type and add linearLinks
- Modify: `src/app/api/tasks/route.ts` — Include linearLinks in query
- Modify: `src/app/api/tasks/[id]/route.ts` — Include linearLinks in query

- [ ] **Step 1: Update TaskWithRuns type and serializeTask in api-helpers.ts**

First, extend the `TaskWithRuns` type alias to include `linearLinks`. Then add `linearLinks` serialization after the runs mapping:

```typescript
// Update the TaskWithRuns type to include linearLinks
type TaskWithRuns = PrismaTask & { runs?: PrismaRun[]; linearLinks?: PrismaLinearLink[] }
```

Add after the runs mapping in `serializeTask`:

```typescript
linearLinks: (task.linearLinks ?? []).map((link) => ({
  id: link.id,
  taskId: link.taskId,
  linearIssueId: link.linearIssueId,
  linearIssueUrl: link.linearIssueUrl,
  linearTeamKey: link.linearTeamKey,
  linearIssueNumber: link.linearIssueNumber,
  linearTitle: link.linearTitle,
  linearStatus: link.linearStatus,
  linearPriority: link.linearPriority,
  linearAssignee: link.linearAssignee,
  syncedAt: link.syncedAt?.toISOString?.() ?? link.syncedAt,
  createdAt: link.createdAt?.toISOString?.() ?? link.createdAt,
  updatedAt: link.updatedAt?.toISOString?.() ?? link.updatedAt,
})),
```

Import `LinearLink as PrismaLinearLink` from `@prisma/client` at the top.

- [ ] **Step 2: Update GET /api/tasks to include linearLinks**

In `src/app/api/tasks/route.ts`, find the `prisma.task.findMany` call and add `linearLinks: true` to the `include` object (alongside `runs`):

```typescript
include: { runs: { orderBy: { startedAt: "desc" } }, linearLinks: true },
```

- [ ] **Step 3: Update GET/PUT /api/tasks/[id] to include linearLinks**

In `src/app/api/tasks/[id]/route.ts`, find both `prisma.task.findUnique` and `prisma.task.update` calls and add `linearLinks: true` to their `include` objects:

```typescript
include: { runs: { orderBy: { startedAt: "desc" } }, linearLinks: true },
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-helpers.ts src/app/api/tasks/route.ts src/app/api/tasks/[id]/route.ts
git commit -m "feat: include linearLinks in task API responses"
```

---

## Task 9: Linear Import API Route

**Files:**
- Create: `src/app/api/linear/import/route.ts`

- [ ] **Step 1: Create import route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLinearClient } from "@/lib/linear-client"
import { serializeTask } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { issueIds, projectId } = await req.json()

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return NextResponse.json({ error: "issueIds array required" }, { status: 400 })
  }
  if (issueIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 issues per import" }, { status: 400 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const tasks = await Promise.all(
    issueIds.map(async (issueId: string) => {
      const issue = await client.issue(issueId)
      const state = await issue.state
      const assignee = await issue.assignee
      const team = await issue.team

      const description = issue.description
        ? issue.description.slice(0, 10_000)
        : null

      const task = await prisma.task.create({
        data: {
          title: issue.title,
          description,
          projectId: projectId || null,
          status: "BACKLOG",
          priority: "MEDIUM",
          linearLinks: {
            create: {
              linearIssueId: issue.id,
              linearIssueUrl: issue.url,
              linearTeamKey: team?.key ?? "",
              linearIssueNumber: issue.number,
              linearTitle: issue.title,
              linearStatus: state?.name ?? null,
              linearPriority: issue.priority,
              linearAssignee: assignee?.name ?? null,
              syncedAt: new Date(),
            },
          },
        },
        include: { runs: true, linearLinks: true },
      })

      return serializeTask(task)
    })
  )

  return NextResponse.json(tasks)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/linear/import/route.ts
git commit -m "feat: add Linear import API route"
```

---

## Task 10: Agent Context Injection

**Files:**
- Modify: `src/app/api/runs/route.ts`

- [ ] **Step 1: Add Linear context injection to runs route**

In `src/app/api/runs/route.ts`, after the task is fetched and before the bridge request is built, add:

```typescript
// Inject Linear ticket context into prompt
let enrichedPrompt = prompt
try {
  const linearLinks = await prisma.linearLink.findMany({
    where: { taskId },
  })
  if (linearLinks.length > 0) {
    const ticketLines = linearLinks
      .map(
        (link) =>
          `- ${link.linearTeamKey}-${link.linearIssueNumber}: "${link.linearTitle}" (${link.linearStatus ?? "Unknown"}) — ${link.linearIssueUrl}`
      )
      .join("\n")
    enrichedPrompt = `${prompt}\n\n---\nLINKED LINEAR TICKETS:\n${ticketLines}\n\nThese Linear tickets are linked to this task. Refer to them for additional context.\nIf you have access to Linear via MCP, you can query them for real-time details.\n---`
  }
} catch (e) {
  console.warn("Failed to fetch linear links for context injection:", e)
}
```

Then use `enrichedPrompt` instead of `prompt` in the bridge request body.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/runs/route.ts
git commit -m "feat: auto-inject linked Linear ticket context into agent prompts"
```

---

## Task 11: Settings Page — Linear Section

**Files:**
- Modify: `src/components/settings-page.tsx`

- [ ] **Step 1: Add Linear state variables**

Add after existing state declarations:

```typescript
const [linearStatus, setLinearStatus] = useState<"checking" | "connected" | "disconnected" | "not-configured">("checking")
const [linearWorkspace, setLinearWorkspace] = useState("")
const [linearEmail, setLinearEmail] = useState("")
const [linearKey, setLinearKey] = useState("")
const [editingLinear, setEditingLinear] = useState(false)
const [showLinearKey, setShowLinearKey] = useState(false)
```

- [ ] **Step 2: Add Linear status check**

Add a `checkLinearStatus` function:

```typescript
async function checkLinearStatus() {
  setLinearStatus("checking")
  try {
    const res = await fetch("/api/linear/status")
    const data = await res.json()
    if (data.connected) {
      setLinearStatus("connected")
      setLinearWorkspace(data.workspace || "")
      setLinearEmail(data.email || "")
    } else {
      setLinearStatus("disconnected")
    }
  } catch {
    setLinearStatus("disconnected")
  }
}
```

Call it in the existing `useEffect` alongside the bridge status check.

- [ ] **Step 3: Add save Linear key function**

```typescript
async function saveLinearKey() {
  if (!linearKey.trim()) return
  try {
    const res = await fetch("/api/linear/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: linearKey }),
    })
    const data = await res.json()
    if (data.connected) {
      setLinearStatus("connected")
      setLinearWorkspace(data.workspace || "")
      setLinearEmail(data.email || "")
      setEditingLinear(false)
      toast.success("Linear connected")
    } else {
      toast.error("Invalid Linear API key")
    }
  } catch {
    toast.error("Failed to connect Linear")
  }
}
```

- [ ] **Step 4: Add Linear UI section**

Add after the Bridge section in the JSX, before Appearance. Follow the same card pattern as Bridge:

```tsx
{/* Linear Integration */}
<div className="card bg-base-200 border border-base-300">
  <div className="card-body gap-4">
    <div className="flex items-center gap-2">
      <LinearIcon size={20} />
      <h2 className="card-title text-sm">Linear</h2>
      {linearStatus === "connected" && (
        <span className="badge badge-success badge-xs ml-1">Connected</span>
      )}
      {linearStatus === "disconnected" && (
        <span className="badge badge-error badge-xs ml-1">Not Connected</span>
      )}
      {linearStatus === "checking" && (
        <span className="badge badge-ghost badge-xs ml-1">Checking...</span>
      )}
    </div>

    {linearStatus === "connected" && !editingLinear ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-base-content/60">
            Workspace: <span className="text-base-content/80 font-medium">{linearWorkspace}</span>
            {linearEmail && <> · {linearEmail}</>}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={() => setEditingLinear(true)}>
            Edit
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-3">
        <div>
          <label className="label text-xs">API Key</label>
          <div className="flex gap-2">
            <input
              type={showLinearKey ? "text" : "password"}
              className="input input-bordered input-sm flex-1 font-mono"
              placeholder="lin_api_..."
              value={linearKey}
              onChange={(e) => setLinearKey(e.target.value)}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowLinearKey(!showLinearKey)}
            >
              {showLinearKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-base-content/50 mt-1">
            Create at Linear → Settings → API → Personal API keys
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={saveLinearKey}>
            Connect
          </button>
          {editingLinear && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingLinear(false)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    )}
  </div>
</div>
```

Import `LinearIcon` at the top of the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings-page.tsx
git commit -m "feat: add Linear connection section to settings page"
```

---

## Task 12: Linear Search Modal Component

**Files:**
- Create: `src/components/linear-search-modal.tsx`

- [ ] **Step 1: Create the shared search modal**

This component is used by both the import flow and the "Link Issue" action in the task panel. It shows a search interface and calls back with selected issues.

```tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LinearIcon } from "@/components/linear-icon"
import { searchLinearIssues, fetchLinearTeams } from "@/lib/api-client"
import type { LinearSearchResult, LinearTeam } from "@/lib/types"

interface LinearSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (issues: LinearSearchResult[]) => void
  mode: "import" | "link"
  title?: string
}

export function LinearSearchModal({
  open,
  onOpenChange,
  onSelect,
  mode,
  title,
}: LinearSearchModalProps) {
  const [query, setQuery] = useState("")
  const [teamId, setTeamId] = useState("all")
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [results, setResults] = useState<LinearSearchResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLinearTeams().then(setTeams).catch(() => {})
    }
  }, [open])

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const issues = await searchLinearIssues({
        q: query || undefined,
        teamId: teamId !== "all" ? teamId : undefined,
      })
      setResults(issues)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, teamId])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query, teamId, open, search])

  function toggleIssue(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const selectedIssues = results.filter((r) => selected.has(r.id))
    onSelect(selectedIssues)
    setSelected(new Set())
    setQuery("")
    onOpenChange(false)
  }

  const statusColors: Record<string, string> = {
    "In Progress": "badge-warning",
    Todo: "badge-info",
    Done: "badge-success",
    Backlog: "badge-ghost",
    Cancelled: "badge-error",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinearIcon size={18} />
            {title ?? (mode === "import" ? "Import from Linear" : "Link Linear Issue")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <input
            className="input input-bordered input-sm flex-1"
            placeholder="Search Linear issues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.key} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
          {loading && (
            <div className="p-4 text-center text-sm text-base-content/50">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-sm text-base-content/50">
              {query ? "No issues found" : "Type to search Linear issues"}
            </div>
          )}
          {results.map((issue) => (
            <label
              key={issue.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-base-200 transition-colors ${
                selected.has(issue.id) ? "bg-primary/5" : ""
              }`}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={selected.has(issue.id)}
                onChange={() => toggleIssue(issue.id)}
              />
              <span className="text-xs font-semibold text-primary w-16 shrink-0">
                {issue.identifier}
              </span>
              <span className="text-sm flex-1 truncate">{issue.title}</span>
              <span className={`badge badge-xs ${statusColors[issue.status] ?? "badge-ghost"}`}>
                {issue.status}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-base-content/50">
            {selected.size} selected
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            {mode === "import"
              ? `Import ${selected.size} Issue${selected.size !== 1 ? "s" : ""}`
              : `Link ${selected.size} Issue${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/linear-search-modal.tsx
git commit -m "feat: add shared Linear search modal component"
```

---

## Task 13: Store Wiring, Import Modal & Kanban Header Button

**Files:**
- Modify: `src/lib/store.ts` — Add linearConnected to AppState
- Modify: `src/app/(dashboard)/layout.tsx` — Wire linearConnected state + fetch in provider
- Create: `src/components/linear-import-modal.tsx`
- Modify: `src/components/kanban-board.tsx`

- [ ] **Step 1: Add linearConnected to store and wire provider**

In `src/lib/store.ts`, add to the `AppState` interface:

```typescript
linearConnected: boolean
setLinearConnected: React.Dispatch<React.SetStateAction<boolean>>
```

In `src/app/(dashboard)/layout.tsx` (where `AppContext.Provider` is used), add the state:

```typescript
const [linearConnected, setLinearConnected] = useState(false)
```

Pass `linearConnected` and `setLinearConnected` in the context value object.

Add a useEffect to check Linear status on load:

```typescript
useEffect(() => {
  fetch("/api/linear/status")
    .then((r) => r.json())
    .then((d) => setLinearConnected(d.connected === true))
    .catch(() => setLinearConnected(false))
}, [])
```

- [ ] **Step 2: Create import modal component**

`src/components/linear-import-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LinearSearchModal } from "@/components/linear-search-modal"
import { importLinearIssues } from "@/lib/api-client"
import { useAppState } from "@/lib/store"
import type { LinearSearchResult } from "@/lib/types"
import { toast } from "sonner"

interface LinearImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LinearImportModal({ open, onOpenChange }: LinearImportModalProps) {
  const { projects, refreshTasks } = useAppState()
  const [projectId, setProjectId] = useState<string>("none")

  async function handleSelect(issues: LinearSearchResult[]) {
    try {
      const pid = projectId !== "none" ? projectId : undefined
      await importLinearIssues(
        issues.map((i) => i.id),
        pid
      )
      await refreshTasks()
      toast.success(`Imported ${issues.length} issue${issues.length !== 1 ? "s" : ""}`)
      onOpenChange(false)
    } catch (e) {
      toast.error("Failed to import issues")
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-base-200 border border-base-300 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
          <span className="text-xs text-base-content/60">Assign to project:</span>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <LinearSearchModal
        open={open}
        onOpenChange={onOpenChange}
        onSelect={handleSelect}
        mode="import"
      />
    </>
  )
}
```

- [ ] **Step 3: Add import button to kanban header**

In `src/components/kanban-board.tsx`, import `LinearImportModal` and `LinearIcon`. Destructure `linearConnected` from the store:

```typescript
const { tasks, setTasks, projects, linearConnected } = useAppState()
const [importModalOpen, setImportModalOpen] = useState(false)
```

In the header `<div>` that contains "Board" and the project filter (line ~330-348), add after `<BridgeStatusDot />`, gated on `linearConnected`:

```tsx
{linearConnected && (
  <button
    className="btn btn-sm gap-1.5 ml-auto"
    style={{ backgroundColor: "#5E6AD2", color: "white", borderColor: "#5E6AD2" }}
    onClick={() => setImportModalOpen(true)}
  >
    <LinearIcon size={14} />
    Import from Linear
  </button>
)}
```

And add the modal before the closing `</div>` of the component:

```tsx
<LinearImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/linear-import-modal.tsx src/components/kanban-board.tsx src/lib/store.ts src/app/(dashboard)/layout.tsx
git commit -m "feat: add Linear import button to kanban header with import modal"
```

---

## Task 14: Task Card — Linear Badge Display

**Files:**
- Modify: `src/components/task-card.tsx`

- [ ] **Step 1: Add hybrid Linear badge to task card**

In `src/components/task-card.tsx`, import `LinearIcon`:

```typescript
import { LinearIcon } from "@/components/linear-icon"
```

Find the card's bottom/metadata area. Add a Linear badge row. After the existing bottom row content, add:

```tsx
{task.linearLinks && task.linearLinks.length > 0 && (
  <div className="flex items-center gap-1 mt-1">
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: "#5E6AD220", color: "#5E6AD2" }}
    >
      <LinearIcon size={10} />
      {task.linearLinks[0].linearTeamKey}-{task.linearLinks[0].linearIssueNumber}
    </span>
    {task.linearLinks.length > 1 && (
      <span className="text-[11px] text-base-content/50">
        +{task.linearLinks.length - 1} more
      </span>
    )}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task-card.tsx
git commit -m "feat: add hybrid Linear badge display to task cards"
```

---

## Task 15: Task Panel — Linked Linear Issues Section

**Files:**
- Create: `src/components/linear-link-section.tsx`
- Modify: `src/components/task-panel.tsx`

- [ ] **Step 1: Create the linked issues section component**

```tsx
"use client"

import { useState } from "react"
import { LinearIcon } from "@/components/linear-icon"
import { LinearSearchModal } from "@/components/linear-search-modal"
import {
  createLinearLink,
  deleteLinearLink,
  syncLinearLinks,
} from "@/lib/api-client"
import type { Task, LinearLink, LinearSearchResult } from "@/lib/types"
import { toast } from "sonner"
import { useAppState } from "@/lib/store"

interface LinearLinkSectionProps {
  task: Task
}

export function LinearLinkSection({ task }: LinearLinkSectionProps) {
  const { setTasks } = useAppState()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const links = task.linearLinks ?? []

  async function handleLink(issues: LinearSearchResult[]) {
    try {
      for (const issue of issues) {
        const link = await createLinearLink(task.id, issue.id)
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, linearLinks: [...(t.linearLinks ?? []), link] }
              : t
          )
        )
      }
      toast.success(`Linked ${issues.length} issue${issues.length !== 1 ? "s" : ""}`)
    } catch {
      toast.error("Failed to link issue")
    }
  }

  async function handleUnlink(linkId: string) {
    try {
      await deleteLinearLink(task.id, linkId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, linearLinks: (t.linearLinks ?? []).filter((l) => l.id !== linkId) }
            : t
        )
      )
      toast.success("Issue unlinked")
    } catch {
      toast.error("Failed to unlink issue")
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const updated = await syncLinearLinks(task.id)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, linearLinks: updated } : t
        )
      )
      toast.success("Linear data refreshed")
    } catch {
      toast.error("Failed to refresh")
    } finally {
      setSyncing(false)
    }
  }

  const statusColors: Record<string, string> = {
    "In Progress": "badge-warning",
    Todo: "badge-info",
    Done: "badge-success",
    Backlog: "badge-ghost",
    Cancelled: "badge-error",
  }

  const oldestSync = links.length > 0
    ? new Date(Math.min(...links.map((l) => new Date(l.syncedAt).getTime())))
    : null

  function timeAgo(date: Date): string {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
          <LinearIcon size={14} />
          Linked Linear Issues
        </h3>
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setLinkModalOpen(true)}
        >
          + Link Issue
        </button>
      </div>

      {links.length > 0 && (
        <>
          <div className="border border-base-300 rounded-lg divide-y divide-base-300 overflow-hidden">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 px-2.5 py-2">
                <a
                  href={link.linearIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  {link.linearTeamKey}-{link.linearIssueNumber}
                </a>
                <span className="text-xs flex-1 truncate text-base-content/80">
                  {link.linearTitle}
                </span>
                {link.linearStatus && (
                  <span className={`badge badge-xs ${statusColors[link.linearStatus] ?? "badge-ghost"}`}>
                    {link.linearStatus}
                  </span>
                )}
                <button
                  className="text-base-content/30 hover:text-error text-xs shrink-0"
                  onClick={() => handleUnlink(link.id)}
                  title="Unlink"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-base-content/40">
              {oldestSync && `Synced ${timeAgo(oldestSync)}`}
            </span>
            <button
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </>
      )}

      {links.length === 0 && (
        <p className="text-xs text-base-content/40">No linked issues</p>
      )}

      <LinearSearchModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        onSelect={handleLink}
        mode="link"
      />
    </div>
  )
}
```

- [ ] **Step 2: Add LinearLinkSection to task-panel.tsx**

In `src/components/task-panel.tsx`, import the component:

```typescript
import { LinearLinkSection } from "@/components/linear-link-section"
```

Add it in the task panel JSX, after the metadata grid section (status/priority/project/SOP) and before the description textarea:

```tsx
<div className="px-4 py-2">
  <LinearLinkSection task={task} />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/linear-link-section.tsx src/components/task-panel.tsx
git commit -m "feat: add linked Linear issues section to task panel"
```

---

---

## Task 16: End-to-End Testing

- [ ] **Step 1: Verify the full flow manually**

1. Start the dev server: `npm run dev`
2. Go to Settings → confirm Linear section appears
3. Enter a Linear API key → confirm "Connected" status
4. Go to Board → confirm "Import from Linear" button appears
5. Click Import → search for issues → select → assign project → import
6. Confirm tasks appear on the board with Linear badges
7. Open a task → confirm Linked Linear Issues section shows
8. Click "+ Link Issue" → search and link another issue
9. Click "✕" to unlink an issue
10. Click "Refresh" to sync data
11. Start a run on a task with linked issues → confirm the prompt includes Linear context

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish Linear integration based on manual testing"
```
