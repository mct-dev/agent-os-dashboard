# Scheduled Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cron-scheduled bridge agent runs with full CRUD, a Google Calendar-style UX, and an Inbox approval flow for missed runs.

**Architecture:** Vercel cron hits `/api/cron/scheduler` every minute, queries Supabase for due `ScheduledJob` rows, resolves per-user bridge URLs, and dispatches runs (or creates InboxItems if the bridge is offline). A new `/schedule` page renders month/week calendar views. Job creation/editing uses a centered modal dialog.

**Tech Stack:** Next.js 16, Prisma, PostgreSQL (Supabase), Vercel Cron, React 19, DaisyUI/Radix UI, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-scheduled-jobs-design.md`

---

## Prerequisites

This plan assumes the working branch is rebased onto `origin/main` (which has the `(dashboard)` route group, Link-based sidebar nav, `VALID_PAGES`/`PAGE_OPTIONS`, etc.).

```bash
git checkout -b feat/scheduled-jobs origin/main
```

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `prisma/migrations/YYYYMMDD_add_scheduled_jobs/migration.sql` | DB migration |
| Modify | `prisma/schema.prisma` | Add ScheduledJob model + relation updates |
| Modify | `src/lib/types.ts` | Add ScheduledJob TypeScript interface |
| Create | `src/lib/schedule-utils.ts` | nextRunAt computation + job occurrence expansion |
| Modify | `src/lib/api-client.ts` | Add schedule CRUD fetch functions |
| Modify | `src/lib/store.ts` | Add scheduledJobs to AppState |
| Modify | `src/app/(dashboard)/layout.tsx` | Add scheduledJobs state + fetchSchedules |
| Create | `src/app/api/schedules/route.ts` | GET (list) + POST (create) |
| Create | `src/app/api/schedules/[id]/route.ts` | PUT (update) + DELETE |
| Create | `src/app/api/schedules/[id]/toggle/route.ts` | POST (enable/disable) |
| Create | `src/app/api/cron/scheduler/route.ts` | Vercel cron handler |
| Create | `src/app/api/inbox/[id]/approve-run/route.ts` | Approve missed run |
| Create | `src/app/(dashboard)/schedule/page.tsx` | Route wrapper |
| Create | `src/components/schedule-page.tsx` | Calendar page (month/week views + toolbar) |
| Create | `src/components/schedule-job-modal.tsx` | Job creation/edit modal dialog |
| Create | `src/components/schedule-calendar-month.tsx` | Month view grid |
| Create | `src/components/schedule-calendar-week.tsx` | Week view grid |
| Modify | `src/components/sidebar.tsx:10` | Add schedule nav item |
| Modify | `src/app/page.tsx:6` | Add "/schedule" to VALID_PAGES |
| Modify | `src/components/settings-page.tsx` | Add schedule to PAGE_OPTIONS |
| Modify | `src/components/agents-page.tsx` | Agent deletion cascade check |
| Modify | `src/components/inbox-page.tsx` | Render approve-run InboxItems |
| Create/Modify | `vercel.json` | Add cron config |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma:81-92` (AgentConfig), `prisma/schema.prisma:94-114` (InboxItem), `prisma/schema.prisma:39-57` (AgentRun), `prisma/schema.prisma:23-37` (Task), `prisma/schema.prisma:11-21` (Project)
- Create: auto-generated migration

- [ ] **Step 1: Add ScheduledJob model to schema.prisma**

Add after the `AgentConfig` model (after line 92):

```prisma
model ScheduledJob {
  id              String       @id @default(cuid())
  userId          String

  name            String

  // What to run
  agentConfigId   String?
  agentConfig     AgentConfig? @relation(fields: [agentConfigId], references: [id], onDelete: SetNull)
  tool            String       @default("claude-code")
  model           String       @default("anthropic/claude-sonnet-4-6")
  prompt          String

  // Schedule
  preset          String       // "once" | "hourly" | "daily" | "weekly" | "monthly"
  scheduledAt     DateTime?
  hour            Int?
  minute          Int?
  dayOfWeek       Int?
  dayOfMonth      Int?

  // Task behavior
  taskMode        String       @default("create")
  taskId          String?
  task            Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  projectId       String?
  project         Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // State
  enabled         Boolean      @default(true)
  pendingApproval Boolean      @default(false)
  missedRunCount  Int          @default(0)
  nextRunAt       DateTime
  lastRunAt       DateTime?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([nextRunAt, enabled])
  @@index([userId])
}
```

- [ ] **Step 2: Add relation back-references to existing models**

Add `scheduledJobs ScheduledJob[]` to `Project` (after line 19), `Task` (after line 36), and `AgentConfig` (after line 91).

Add to `InboxItem` (after line 107):
```prisma
  scheduledJobId String?
  action         String?
```

Add to `AgentRun` (after line 54):
```prisma
  scheduledJobId String?
```

- [ ] **Step 3: Generate and apply migration**

```bash
npx prisma migrate dev --name add_scheduled_jobs
```

- [ ] **Step 4: Verify migration applied**

```bash
npx prisma migrate status
```

Expected: all migrations applied, no pending.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add ScheduledJob model with relations"
```

---

### Task 2: TypeScript Types + Schedule Utils

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/schedule-utils.ts`

- [ ] **Step 1: Add ScheduledJob interface to types.ts**

Add after the `AgentConfig` interface (after line 66):

```typescript
export type SchedulePreset = "once" | "hourly" | "daily" | "weekly" | "monthly"
export type TaskMode = "create" | "reuse"

export interface ScheduledJob {
  id: string
  userId: string
  name: string
  agentConfigId: string | null
  tool: string
  model: string
  prompt: string
  preset: SchedulePreset
  scheduledAt: string | null
  hour: number | null
  minute: number | null
  dayOfWeek: number | null
  dayOfMonth: number | null
  taskMode: TaskMode
  taskId: string | null
  projectId: string | null
  enabled: boolean
  pendingApproval: boolean
  missedRunCount: number
  nextRunAt: string
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}
```

Also add `scheduledJobId?: string | null` and `action?: string | null` to the `InboxItem` interface (after the `replyText` field).

Also add `scheduledJobId?: string | null` to the `AgentRun` interface (after the `agentConfigId` field).

- [ ] **Step 2: Create schedule-utils.ts with nextRunAt computation**

Create `src/lib/schedule-utils.ts`:

```typescript
import type { SchedulePreset } from "./types"

/**
 * Compute the next run time for a scheduled job.
 * All times are UTC.
 */
export function computeNextRunAt(
  preset: SchedulePreset,
  opts: {
    scheduledAt?: Date | null
    hour?: number | null
    minute?: number | null
    dayOfWeek?: number | null   // 0=Sun..6=Sat
    dayOfMonth?: number | null  // 1-31
    after?: Date                // compute next occurrence after this time
  }
): Date | null {
  const now = opts.after ?? new Date()

  switch (preset) {
    case "once":
      return opts.scheduledAt ?? null

    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000)

    case "daily": {
      const next = new Date(now)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
      return next
    }

    case "weekly": {
      const target = opts.dayOfWeek ?? 0
      const next = new Date(now)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      const currentDay = next.getUTCDay()
      let daysAhead = target - currentDay
      if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
        daysAhead += 7
      }
      next.setUTCDate(next.getUTCDate() + daysAhead)
      return next
    }

    case "monthly": {
      const target = opts.dayOfMonth ?? 1
      const next = new Date(now)
      next.setUTCDate(target)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      if (next <= now) {
        next.setUTCMonth(next.getUTCMonth() + 1)
        next.setUTCDate(target)
      }
      return next
    }

    default:
      return null
  }
}

/**
 * Expand a scheduled job into occurrence dates within a date range.
 * Used by the calendar to render job pills on the correct days.
 */
export function expandOccurrences(
  job: {
    preset: SchedulePreset
    enabled: boolean
    scheduledAt?: string | null
    hour?: number | null
    minute?: number | null
    dayOfWeek?: number | null
    dayOfMonth?: number | null
    nextRunAt: string
  },
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const dates: Date[] = []

  if (job.preset === "once") {
    const d = job.scheduledAt ? new Date(job.scheduledAt) : new Date(job.nextRunAt)
    if (d >= rangeStart && d < rangeEnd) dates.push(d)
    return dates
  }

  // For recurring: walk forward from rangeStart
  let cursor = computeNextRunAt(job.preset, {
    hour: job.hour,
    minute: job.minute,
    dayOfWeek: job.dayOfWeek,
    dayOfMonth: job.dayOfMonth,
    after: new Date(rangeStart.getTime() - 1),
  })

  const maxIterations = 366 // safety cap
  let i = 0
  while (cursor && cursor < rangeEnd && i < maxIterations) {
    if (cursor >= rangeStart) dates.push(new Date(cursor))
    cursor = computeNextRunAt(job.preset, {
      hour: job.hour,
      minute: job.minute,
      dayOfWeek: job.dayOfWeek,
      dayOfMonth: job.dayOfMonth,
      after: cursor,
    })
    i++
  }

  return dates
}

/** Day-of-week labels for display */
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Short day-of-week labels */
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Preset labels for display */
export const PRESET_LABELS: Record<SchedulePreset, string> = {
  once: "Once",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/schedule-utils.ts
git commit -m "feat: add ScheduledJob types and schedule utility functions"
```

---

### Task 3: API Client + App State

**Files:**
- Modify: `src/lib/api-client.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add schedule CRUD functions to api-client.ts**

Add after the Inbox section (after line 238):

```typescript
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
```

Add the import at the top of the file:
```typescript
import type { ScheduledJob } from "./types"
```

- [ ] **Step 2: Add scheduledJobs to AppState interface in store.ts**

Add to the `AppState` interface:
```typescript
  scheduledJobs: ScheduledJob[]
  setScheduledJobs: React.Dispatch<React.SetStateAction<ScheduledJob[]>>
  refreshSchedules: () => Promise<void>
```

Add `ScheduledJob` to the import from `./types`.

- [ ] **Step 3: Wire up scheduledJobs in dashboard layout.tsx**

Add `fetchSchedules` to the import from `@/lib/api-client`.

Add state:
```typescript
const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([])
```

Add refresh callback:
```typescript
const refreshSchedules = useCallback(async () => {
  setScheduledJobs(await fetchSchedules())
}, [])
```

Add `fetchSchedules()` to the `Promise.all` call (after `fetchInbox()`). Destructure as `sj` and call `setScheduledJobs(sj)`.

Add `scheduledJobs, setScheduledJobs, refreshSchedules` to the `AppContext.Provider` value.

Add `ScheduledJob` to the import from `@/lib/types`.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-client.ts src/lib/store.ts 'src/app/(dashboard)/layout.tsx'
git commit -m "feat: add schedule state management and API client functions"
```

---

### Task 4: Schedule CRUD API Routes

**Files:**
- Create: `src/app/api/schedules/route.ts`
- Create: `src/app/api/schedules/[id]/route.ts`
- Create: `src/app/api/schedules/[id]/toggle/route.ts`

- [ ] **Step 1: Create GET + POST route at /api/schedules**

Create `src/app/api/schedules/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobs = await prisma.scheduledJob.findMany({
    where: { userId: session.user.email },
    orderBy: { nextRunAt: "asc" },
  })

  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, agentConfigId, tool, model, prompt, preset, scheduledAt, hour, minute, dayOfWeek, dayOfMonth, taskMode, taskId, projectId } = body

  if (!name?.trim() || !prompt?.trim() || !preset) {
    return NextResponse.json({ error: "name, prompt, and preset are required" }, { status: 400 })
  }

  const validPresets = ["once", "hourly", "daily", "weekly", "monthly"]
  if (!validPresets.includes(preset)) {
    return NextResponse.json({ error: "Invalid preset" }, { status: 400 })
  }

  // For one-time jobs, reject past dates
  if (preset === "once") {
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      return NextResponse.json({ error: "One-time jobs must have a future scheduledAt" }, { status: 400 })
    }
  }

  const nextRunAt = computeNextRunAt(preset as SchedulePreset, {
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    hour, minute, dayOfWeek, dayOfMonth,
  })

  if (!nextRunAt) {
    return NextResponse.json({ error: "Could not compute next run time" }, { status: 400 })
  }

  const job = await prisma.scheduledJob.create({
    data: {
      userId: session.user.email,
      name: name.trim(),
      agentConfigId: agentConfigId || null,
      tool: tool ?? "claude-code",
      model: model ?? "anthropic/claude-sonnet-4-6",
      prompt: prompt.trim(),
      preset,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      hour: hour ?? null,
      minute: minute ?? null,
      dayOfWeek: dayOfWeek ?? null,
      dayOfMonth: dayOfMonth ?? null,
      taskMode: taskMode ?? "create",
      taskId: taskId || null,
      projectId: projectId || null,
      nextRunAt,
    },
  })

  return NextResponse.json(job, { status: 201 })
}
```

- [ ] **Step 2: Create PUT + DELETE route at /api/schedules/[id]**

Create `src/app/api/schedules/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.scheduledJob.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const { name, agentConfigId, tool, model, prompt, preset: newPreset,
          scheduledAt, hour, minute, dayOfWeek, dayOfMonth,
          taskMode, taskId, projectId, enabled } = body

  // Recompute nextRunAt if schedule fields changed
  const preset = (newPreset ?? existing.preset) as SchedulePreset
  const resolvedScheduledAt = scheduledAt !== undefined
    ? (scheduledAt ? new Date(scheduledAt) : null)
    : existing.scheduledAt
  const scheduleFields = {
    scheduledAt: resolvedScheduledAt,
    hour: hour !== undefined ? hour : existing.hour,
    minute: minute !== undefined ? minute : existing.minute,
    dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existing.dayOfWeek,
    dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : existing.dayOfMonth,
  }

  const nextRunAt = computeNextRunAt(preset, scheduleFields) ?? existing.nextRunAt

  const updated = await prisma.scheduledJob.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(agentConfigId !== undefined && { agentConfigId: agentConfigId || null }),
      ...(tool !== undefined && { tool }),
      ...(model !== undefined && { model }),
      ...(prompt !== undefined && { prompt }),
      ...(newPreset !== undefined && { preset: newPreset }),
      ...(taskMode !== undefined && { taskMode }),
      ...(taskId !== undefined && { taskId: taskId || null }),
      ...(projectId !== undefined && { projectId: projectId || null }),
      ...(enabled !== undefined && { enabled }),
      scheduledAt: resolvedScheduledAt,
      hour: scheduleFields.hour,
      minute: scheduleFields.minute,
      dayOfWeek: scheduleFields.dayOfWeek,
      dayOfMonth: scheduleFields.dayOfMonth,
      nextRunAt,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.scheduledJob.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Dismiss related InboxItems
  await prisma.inboxItem.deleteMany({
    where: { scheduledJobId: id },
  })

  await prisma.scheduledJob.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create toggle route at /api/schedules/[id]/toggle**

Create `src/app/api/schedules/[id]/toggle/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.scheduledJob.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const newEnabled = !existing.enabled

  // If re-enabling, recompute nextRunAt
  let nextRunAt = existing.nextRunAt
  if (newEnabled) {
    nextRunAt = computeNextRunAt(existing.preset as SchedulePreset, {
      scheduledAt: existing.scheduledAt,
      hour: existing.hour,
      minute: existing.minute,
      dayOfWeek: existing.dayOfWeek,
      dayOfMonth: existing.dayOfMonth,
    }) ?? existing.nextRunAt
  }

  const updated = await prisma.scheduledJob.update({
    where: { id },
    data: {
      enabled: newEnabled,
      pendingApproval: false,
      missedRunCount: 0,
      nextRunAt,
    },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Verify routes compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/schedules/
git commit -m "feat: add schedule CRUD API routes"
```

---

### Task 5: Cron Scheduler Route

**Files:**
- Create: `src/app/api/cron/scheduler/route.ts`
- Create/Modify: `vercel.json`

- [ ] **Step 1: Create the cron scheduler route**

Create `src/app/api/cron/scheduler/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Find all due jobs
  const dueJobs = await prisma.scheduledJob.findMany({
    where: {
      nextRunAt: { lte: now },
      enabled: true,
      pendingApproval: false,
    },
  })

  const results: { jobId: string; status: string }[] = []

  // Group by userId to batch bridge lookups
  const userIds = [...new Set(dueJobs.map((j) => j.userId))]
  const settingsMap = new Map<string, { bridgeUrl: string; bridgeApiKey: string | null }>()

  for (const userId of userIds) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    })
    if (settings?.bridgeUrl) {
      settingsMap.set(userId, {
        bridgeUrl: settings.bridgeUrl.replace(/\/+$/, ""),
        bridgeApiKey: settings.bridgeApiKey,
      })
    }
  }

  for (const job of dueJobs) {
    // Duplicate prevention: skip if ran in last 55 seconds
    if (job.lastRunAt && now.getTime() - job.lastRunAt.getTime() < 55_000) {
      results.push({ jobId: job.id, status: "skipped_recent" })
      continue
    }

    const userSettings = settingsMap.get(job.userId)
    if (!userSettings) {
      results.push({ jobId: job.id, status: "no_bridge_configured" })
      continue
    }

    // Check bridge health
    let bridgeOnline = false
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const healthRes = await fetch(`${userSettings.bridgeUrl}/api/health`, {
        headers: { "x-api-key": userSettings.bridgeApiKey ?? "" },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      bridgeOnline = healthRes.ok
    } catch {
      bridgeOnline = false
    }

    if (bridgeOnline) {
      try {
        // Resolve task
        let taskId = job.taskId
        let taskTitle = job.name

        if (job.taskMode === "create" || !taskId) {
          const isoDate = now.toISOString().split("T")[0]
          taskTitle = `${job.name} — ${isoDate}`
          const newTask = await prisma.task.create({
            data: {
              title: taskTitle,
              status: "TODO",
              projectId: job.projectId || undefined,
            },
          })
          taskId = newTask.id
        }

        // Dispatch to bridge
        // job.model is stored in combined "provider/model" format (e.g. "anthropic/claude-sonnet-4-6")
        // matching LLM_MODELS and the existing /api/runs route pattern
        const bridgeRes = await fetch(`${userSettings.bridgeUrl}/api/runs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": userSettings.bridgeApiKey ?? "",
          },
          body: JSON.stringify({
            task_id: taskId,
            task_title: taskTitle,
            task_description: "",
            prompt: job.prompt,
            model: job.model,
          }),
        })

        if (bridgeRes.ok) {
          const bridgeData = await bridgeRes.json()

          // Create AgentRun record
          await prisma.agentRun.create({
            data: {
              taskId,
              bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
              status: "RUNNING",
              model: job.model,
              prompt: job.prompt,
              scheduledJobId: job.id,
            },
          })
        }

        // Update job: advance schedule
        const nextRunAt = computeNextRunAt(job.preset as SchedulePreset, {
          scheduledAt: job.scheduledAt,
          hour: job.hour,
          minute: job.minute,
          dayOfWeek: job.dayOfWeek,
          dayOfMonth: job.dayOfMonth,
          after: now,
        })

        await prisma.scheduledJob.update({
          where: { id: job.id },
          data: {
            lastRunAt: now,
            missedRunCount: 0,
            nextRunAt: nextRunAt ?? now,
            enabled: job.preset === "once" ? false : job.enabled,
          },
        })

        results.push({ jobId: job.id, status: "dispatched" })
      } catch (err) {
        results.push({ jobId: job.id, status: `error: ${err instanceof Error ? err.message : "unknown"}` })
      }
    } else {
      // Bridge offline — queue for approval
      const newMissedCount = job.missedRunCount + 1

      // Check for existing InboxItem
      const existingInboxItem = await prisma.inboxItem.findFirst({
        where: { scheduledJobId: job.id, action: "approve_run", read: false },
      })

      const message = newMissedCount > 1
        ? `Scheduled job '${job.name}' missed ${newMissedCount} run(s). Bridge was offline. Approve to run now?`
        : `Scheduled job '${job.name}' was due but bridge was offline. Approve to run now?`

      if (existingInboxItem) {
        await prisma.inboxItem.update({
          where: { id: existingInboxItem.id },
          data: { question: message },
        })
      } else {
        await prisma.inboxItem.create({
          data: {
            agentName: job.name,
            taskTitle: `Missed scheduled run`,
            question: message,
            priority: "HIGH",
            scheduledJobId: job.id,
            action: "approve_run",
          },
        })
      }

      // Advance nextRunAt so we don't re-queue every minute
      const nextRunAt = computeNextRunAt(job.preset as SchedulePreset, {
        scheduledAt: job.scheduledAt,
        hour: job.hour,
        minute: job.minute,
        dayOfWeek: job.dayOfWeek,
        dayOfMonth: job.dayOfMonth,
        after: now,
      })

      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          pendingApproval: true,
          missedRunCount: newMissedCount,
          nextRunAt: nextRunAt ?? now,
        },
      })

      results.push({ jobId: job.id, status: "bridge_offline_queued" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
```

- [ ] **Step 2: Create or update vercel.json**

Check if `vercel.json` exists; if not, create it. Add the cron config:

```json
{
  "crons": [
    {
      "path": "/api/cron/scheduler",
      "schedule": "* * * * *"
    }
  ]
}
```

If `vercel.json` already exists, merge the `crons` array into it.

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/ vercel.json
git commit -m "feat: add Vercel cron scheduler for scheduled jobs"
```

---

### Task 6: Inbox Approve-Run Route

**Files:**
- Create: `src/app/api/inbox/[id]/approve-run/route.ts`

- [ ] **Step 1: Create the approve-run route**

Create `src/app/api/inbox/[id]/approve-run/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const inboxItem = await prisma.inboxItem.findUnique({ where: { id } })
  if (!inboxItem || inboxItem.action !== "approve_run" || !inboxItem.scheduledJobId) {
    return NextResponse.json({ error: "Invalid inbox item" }, { status: 400 })
  }

  const job = await prisma.scheduledJob.findUnique({
    where: { id: inboxItem.scheduledJobId },
  })
  if (!job || job.userId !== session.user.email) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  // Get bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })
  if (!settings?.bridgeUrl) {
    return NextResponse.json({ error: "Bridge not configured" }, { status: 400 })
  }

  const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")

  // Check bridge health
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const healthRes = await fetch(`${bridgeUrl}/api/health`, {
      headers: { "x-api-key": settings.bridgeApiKey ?? "" },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!healthRes.ok) {
      return NextResponse.json({ error: "Bridge is still offline" }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: "Bridge is still offline" }, { status: 502 })
  }

  // Resolve task
  const now = new Date()
  let taskId = job.taskId
  let taskTitle = job.name

  if (job.taskMode === "create" || !taskId) {
    const isoDate = now.toISOString().split("T")[0]
    taskTitle = `${job.name} — ${isoDate}`
    const newTask = await prisma.task.create({
      data: {
        title: taskTitle,
        status: "TODO",
        projectId: job.projectId || undefined,
      },
    })
    taskId = newTask.id
  }

  // Dispatch to bridge
  const bridgeRes = await fetch(`${bridgeUrl}/api/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.bridgeApiKey ?? "",
    },
    body: JSON.stringify({
      task_id: taskId,
      task_title: taskTitle,
      task_description: "",
      prompt: job.prompt,
      model: job.model,
    }),
  })

  if (!bridgeRes.ok) {
    return NextResponse.json({ error: "Failed to dispatch run to bridge" }, { status: 502 })
  }

  const bridgeData = await bridgeRes.json()

  // Create AgentRun record
  await prisma.agentRun.create({
    data: {
      taskId,
      bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
      status: "RUNNING",
      model: job.model,
      prompt: job.prompt,
      scheduledJobId: job.id,
    },
  })

  // Clear pending state on job
  const nextRunAt = computeNextRunAt(job.preset as SchedulePreset, {
    scheduledAt: job.scheduledAt,
    hour: job.hour,
    minute: job.minute,
    dayOfWeek: job.dayOfWeek,
    dayOfMonth: job.dayOfMonth,
    after: now,
  })

  await prisma.scheduledJob.update({
    where: { id: job.id },
    data: {
      pendingApproval: false,
      missedRunCount: 0,
      lastRunAt: now,
      nextRunAt: nextRunAt ?? now,
    },
  })

  // Mark inbox item as read
  await prisma.inboxItem.update({
    where: { id },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inbox/
git commit -m "feat: add inbox approve-run route for missed scheduled jobs"
```

---

### Task 7: Navigation Integration

**Files:**
- Modify: `src/components/sidebar.tsx:10`
- Modify: `src/app/page.tsx:6`
- Modify: `src/components/settings-page.tsx`

- [ ] **Step 1: Add schedule to sidebar navItems**

In `src/components/sidebar.tsx`, add to the `navItems` array (after the agents entry):

```typescript
  { id: "schedule", label: "Schedule", icon: "📅", href: "/schedule" },
```

- [ ] **Step 2: Add /schedule to VALID_PAGES in page.tsx**

In `src/app/page.tsx`, add `"/schedule"` to the `VALID_PAGES` array:

```typescript
const VALID_PAGES = ["/board", "/inbox", "/projects", "/sops", "/agents", "/settings", "/schedule"]
```

- [ ] **Step 3: Add schedule to PAGE_OPTIONS in settings-page.tsx**

In `src/components/settings-page.tsx`, add to the `PAGE_OPTIONS` array:

```typescript
  { value: "/schedule", label: "Schedule" },
```

- [ ] **Step 4: Create the route wrapper**

Create `src/app/(dashboard)/schedule/page.tsx`:

```typescript
import { SchedulePage } from "@/components/schedule-page"

export default function ScheduleRoute() {
  return <SchedulePage />
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/app/page.tsx src/components/settings-page.tsx 'src/app/(dashboard)/schedule/page.tsx'
git commit -m "feat: add Schedule page to navigation and routing"
```

---

### Task 8: Job Creation/Edit Modal

**Files:**
- Create: `src/components/schedule-job-modal.tsx`

- [ ] **Step 1: Create the job modal component**

Create `src/components/schedule-job-modal.tsx`. This is a centered dialog (matching the NewTaskDialog pattern) with:

- Name input
- Agent dropdown (optional, from `agents` in AppState — pre-fills tool/model)
- Tool/Model cascading dropdowns (fetch from `/api/tools` and `/api/tools/{id}/models`)
- Preset pill selector (Once | Hourly | Daily | Weekly | Monthly)
- Conditional time fields based on preset:
  - Once: date input + time input
  - Hourly: nothing extra
  - Daily: time input
  - Weekly: day-of-week select + time input
  - Monthly: day-of-month select + time input
- Prompt textarea
- Task mode toggle ("New task each run" | "Reuse task") — if reuse, show task selector
- Project dropdown
- In edit mode: Delete button (with AlertDialog confirmation), Enable/Disable toggle
- Save / Cancel buttons

The component should:
- Accept `open`, `onOpenChange`, `editJob?` (for edit mode), `defaultDate?` (for calendar click pre-fill)
- Use `useAppState()` for agents, projects, tasks
- Call `createSchedule()` / `updateSchedule()` / `deleteSchedule()` from api-client
- Call `refreshSchedules()` after mutations
- Convert local time inputs to UTC for storage, UTC from storage back to local for display
- Show toast on error

Full implementation: use the same Dialog/Select/Input/Button/Textarea imports as `new-task-dialog.tsx` and `agents-page.tsx`. The preset selector should be a row of buttons with active state styling (like `btn-primary` vs `btn-ghost` in daisyUI). Time fields use native `<input type="time">` and `<input type="date">` for simplicity.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule-job-modal.tsx
git commit -m "feat: add schedule job creation/edit modal"
```

---

### Task 9: Calendar Month View Component

**Files:**
- Create: `src/components/schedule-calendar-month.tsx`

- [ ] **Step 1: Create the month view grid component**

Create `src/components/schedule-calendar-month.tsx`. This renders:

- A 7-column CSS grid (Sun–Sat)
- Header row with day names
- 5-6 rows of day cells for the current month
- Days outside the current month shown with reduced opacity
- Today's cell highlighted with a distinct background
- Each cell renders job "pills" — small colored badges with truncated job name
- Disabled jobs shown with `opacity-50`
- Click handler on a pill → calls `onEditJob(job)`
- Click handler on empty cell area → calls `onCreateJob(date)`

Props:
```typescript
interface MonthViewProps {
  year: number
  month: number  // 0-indexed
  jobs: ScheduledJob[]
  onEditJob: (job: ScheduledJob) => void
  onCreateJob: (date: Date) => void
}
```

Use `expandOccurrences` from `schedule-utils.ts` to determine which days each job appears on. Build a `Map<string, { job, date }[]>` keyed by ISO date string for O(1) lookup per cell.

Assign each job a color from a small palette (based on index or a hash of the job id).

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule-calendar-month.tsx
git commit -m "feat: add calendar month view component"
```

---

### Task 10: Calendar Week View Component

**Files:**
- Create: `src/components/schedule-calendar-week.tsx`

- [ ] **Step 1: Create the week view grid component**

Create `src/components/schedule-calendar-week.tsx`. This renders:

- A 7-column grid for the current week (Sun–Sat)
- Y-axis: 24 hour rows (or a subset, e.g., 6am–11pm)
- Jobs rendered as positioned blocks at their hour/minute within the column
- Hourly jobs render in every hour slot
- Today's column highlighted
- Click handler on a block → `onEditJob(job)`
- Click handler on empty slot → `onCreateJob(date)` with date set to that day + hour

Props:
```typescript
interface WeekViewProps {
  weekStart: Date  // Sunday of the week
  jobs: ScheduledJob[]
  onEditJob: (job: ScheduledJob) => void
  onCreateJob: (date: Date) => void
}
```

Use `expandOccurrences` for the week range. Position blocks using CSS `top` based on the hour/minute within the day. Use `position: relative` on columns, `position: absolute` on job blocks.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule-calendar-week.tsx
git commit -m "feat: add calendar week view component"
```

---

### Task 11: Schedule Page (Orchestrator)

**Files:**
- Create: `src/components/schedule-page.tsx`

- [ ] **Step 1: Create the schedule page component**

Create `src/components/schedule-page.tsx`. This orchestrates:

- **State:** `currentDate` (Date), `view` ("month" | "week"), `modalOpen` (boolean), `editingJob` (ScheduledJob | null), `createDate` (Date | null)
- **Top toolbar:**
  - Month/year title (e.g., "March 2026") or week range for week view
  - Prev/Next buttons to navigate months/weeks
  - "Today" button to jump to current date
  - Month/Week toggle (two buttons, active state on selected)
  - "+ New Job" button → opens modal with no pre-fill
- **Body:** renders `<MonthView>` or `<WeekView>` based on `view` state
- **Modal:** `<ScheduleJobModal>` controlled by `modalOpen`, `editingJob`, `createDate`

Handlers:
- `handleEditJob(job)` → set editingJob, open modal
- `handleCreateJob(date)` → set createDate, clear editingJob, open modal
- `handleModalClose()` → close modal, clear editingJob/createDate

Use `useAppState()` to get `scheduledJobs` and `refreshSchedules`.

- [ ] **Step 2: Verify the full page works**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schedule-page.tsx
git commit -m "feat: add schedule page with month/week views and toolbar"
```

---

### Task 12: Inbox Approve-Run UI

**Files:**
- Modify: `src/components/inbox-page.tsx`

- [ ] **Step 1: Add approve-run rendering to InboxPage**

In `src/components/inbox-page.tsx`, add handling for InboxItems with `action === "approve_run"`:

- Import `approveScheduledRun` from `@/lib/api-client`
- When rendering an item, check `item.action === "approve_run"`
- If so, render an "Approve & Run" button (styled as `btn-primary btn-sm`) alongside the existing dismiss/snooze actions
- On click: call `approveScheduledRun(item.id)`, then `refreshInbox()` and `refreshSchedules()`
- Show toast on success ("Run dispatched") or error ("Bridge still offline")
- Add `refreshSchedules` to the destructured values from `useAppState()`

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/inbox-page.tsx
git commit -m "feat: add approve-run action to inbox for missed scheduled jobs"
```

---

### Task 13: Agent Deletion Cascade

**Files:**
- Modify: `src/components/agents-page.tsx`

- [ ] **Step 1: Add pre-delete check for scheduled jobs**

In `src/components/agents-page.tsx`, modify the delete handler:

- Before deleting, fetch scheduled jobs from AppState (`scheduledJobs` from `useAppState()`)
- Filter for jobs where `agentConfigId === agent.id`
- If any exist, show a blocking dialog instead of the normal delete confirmation:
  - Title: "Agent used by scheduled jobs"
  - Body: list the affected job names
  - Message: "Reassign these jobs to another agent or delete them before removing this agent."
  - Action buttons: "Go to Schedule" (navigates to `/schedule`) and "Cancel"
- If no associated jobs, proceed with normal delete flow

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agents-page.tsx
git commit -m "feat: block agent deletion when used by scheduled jobs"
```

---

### Task 14: End-to-End Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Start dev server and test manually**

```bash
npm run dev
```

Verify:
1. Navigate to `/schedule` — calendar renders with month view
2. Click "+ New Job" — modal opens with all fields
3. Create a job (e.g., daily at a specific time) — job appears on calendar
4. Click the job pill — edit modal opens with pre-filled values
5. Toggle month/week view — both render correctly
6. Toggle enable/disable on a job — opacity changes
7. Delete a job — disappears from calendar
8. Check `/inbox` — if bridge is offline and cron fires, approve-run items should appear

- [ ] **Step 3: Run linter if configured**

```bash
npm run lint 2>/dev/null || echo "No lint script"
```

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
