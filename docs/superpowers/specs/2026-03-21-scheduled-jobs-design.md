# Scheduled Jobs — Design Spec

Schedule bridge agent runs on recurring or one-time cron schedules, managed via a full calendar UX.

### Prerequisites

Implementation requires rebasing onto `origin/main`, which provides the `(dashboard)` route group, Link-based sidebar navigation with `href` properties, `VALID_PAGES`/`PAGE_OPTIONS` constants, and per-route page wrappers.

## Overview

Standalone scheduled jobs combine an agent config (or inline tool/model) + prompt + task creation behavior into a single schedulable entity. A Vercel cron route runs every minute, queries for due jobs, and dispatches them to the bridge — or queues missed runs for user approval via Inbox if the bridge is offline.

### Multi-tenancy note

The existing models (Task, Project, AgentConfig, etc.) are effectively single-tenant — they have no `userId` field. `ScheduledJob` adds `userId` because the server-side cron must resolve the correct bridge URL per user (from `UserSettings.bridgeUrl`). This is the first model that requires user scoping at the query level.

The scheduler resolves bridge details via two sequential Prisma queries (no raw SQL): first `prisma.scheduledJob.findMany(...)` for due jobs, then `prisma.userSettings.findUnique(...)` per unique userId. A Prisma relation is not added between `ScheduledJob` and `UserSettings` to avoid coupling the scheduling model to the settings model — the userId string is sufficient for the lookup.

## Data Model

New Prisma model `ScheduledJob`:

```prisma
model ScheduledJob {
  id            String    @id @default(cuid())
  userId        String

  name          String                          // "Weekly stale branch scan"

  // What to run
  agentConfigId String?
  agentConfig   AgentConfig? @relation(fields: [agentConfigId], references: [id])
  tool          String    @default("claude-code")
  model         String    @default("claude-sonnet-4-6")
  prompt        String                          // The prompt to execute

  // Schedule
  preset        String                          // "once" | "hourly" | "daily" | "weekly" | "monthly"
  scheduledAt   DateTime?                       // For one-time jobs: exact datetime
  hour          Int?                            // For daily/weekly/monthly: hour (0-23)
  minute        Int?                            // For daily/weekly/monthly: minute (0-59)
  dayOfWeek     Int?                            // For weekly: 0=Sun..6=Sat
  dayOfMonth    Int?                            // For monthly: 1-31

  // Task behavior
  taskMode      String    @default("create")    // "create" (new task each run) | "reuse" (single persistent task)
  taskId        String?                         // For "reuse" mode: the persistent task
  task          Task?     @relation(fields: [taskId], references: [id])
  projectId     String?                         // Which project to create tasks in
  project       Project?  @relation(fields: [projectId], references: [id])

  // State
  enabled       Boolean   @default(true)
  pendingApproval Boolean @default(false)
  missedRunCount Int      @default(0)
  nextRunAt     DateTime                        // Computed: when the next run is due
  lastRunAt     DateTime?

  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

Key decisions:
- Preset-based scheduling (no raw cron expressions). `preset` + time fields determine cadence.
- `nextRunAt` is the query target for the scheduler cron.
- `agentConfigId` is optional — user can pick an existing agent or configure tool/model inline.
- `pendingApproval` and `missedRunCount` support the offline bridge flow.

### Relation changes

- `AgentConfig` gains a `scheduledJobs ScheduledJob[]` relation.
- `Task` gains a `scheduledJobs ScheduledJob[]` relation (for reuse mode).
- `Project` gains a `scheduledJobs ScheduledJob[]` relation.
- `InboxItem` gains an optional `scheduledJobId String?` and `action String?` field.
- `AgentRun` gains an optional `scheduledJobId String?` for tracing which schedule triggered it.

## Scheduler Engine

A Vercel cron route at `POST /api/cron/scheduler` runs every minute.

### Flow

```
Every minute:
  1. Query: SELECT sj.*, us.bridgeUrl, us.bridgeApiKey FROM ScheduledJob sj
     JOIN UserSettings us ON sj.userId = us.userId
     WHERE sj.nextRunAt <= now() AND sj.enabled = true AND sj.pendingApproval = false
  2. For each due job (using the user's bridgeUrl from UserSettings):
     a. Check bridge health (GET bridgeUrl/api/health)
     b. IF bridge online:
        - taskMode="create": create new Task with title "{job.name} — {ISO date}",
          status=TODO, projectId=job.projectId, then dispatch run to bridge
        - taskMode="reuse": dispatch run against existing taskId
        - Set lastRunAt = now(), missedRunCount = 0
        - Compute nextRunAt from preset (or set enabled=false for one-time)
     c. IF bridge offline:
        - Increment missedRunCount
        - If no pending InboxItem exists for this job:
          - Create InboxItem with action="approve_run", scheduledJobId
          - Message includes missedRunCount if > 1
        - Else update existing InboxItem message with new missedRunCount
        - Set pendingApproval = true
        - Advance nextRunAt to next future occurrence (prevent re-queuing)
  3. Duplicate prevention: skip if lastRunAt is within last 55 seconds
```

### Security

Protected by `CRON_SECRET` env var. Vercel passes the `Authorization: Bearer <CRON_SECRET>` header automatically. Route rejects unauthorized calls.

### Timezone handling

All schedule times are stored and computed in UTC. The UI converts between the user's local timezone and UTC for display and input. The `hour` and `minute` fields in the database are always UTC values.

### nextRunAt computation

- `once` → set `enabled = false`, no next run
- `hourly` → `lastRunAt` + 1 hour (the creation time anchors all subsequent runs)
- `daily` → next occurrence of `hour:minute` UTC (today if not yet passed, else tomorrow)
- `weekly` → next occurrence of `dayOfWeek` at `hour:minute` UTC
- `monthly` → next occurrence of `dayOfMonth` at `hour:minute` UTC

## Inbox Approval Flow

When a scheduled job fires but the bridge is offline:

1. Scheduler creates an InboxItem:
   - `scheduledJobId` links to the job
   - `action = "approve_run"`
   - Message: "Scheduled job '{name}' missed {count} run(s) (last due: {time}). Bridge was offline. Approve to run now?"
2. Job sets `pendingApproval = true`
3. When user clicks "Approve & Run" in Inbox:
   - `POST /api/inbox/[id]/approve-run`
   - Checks bridge health → dispatches run
   - Clears `pendingApproval`, resets `missedRunCount`
   - Marks InboxItem as read
4. If user dismisses the InboxItem instead:
   - Clears `pendingApproval`, resets `missedRunCount`
   - No run dispatched, job resumes normal schedule

## API Routes

### Scheduled Job CRUD

- `GET /api/schedules` — list all jobs for authenticated user
- `POST /api/schedules` — create job, compute initial `nextRunAt`
- `PUT /api/schedules/[id]` — update job, recompute `nextRunAt`
- `DELETE /api/schedules/[id]` — delete job + dismiss related InboxItems
- `POST /api/schedules/[id]/toggle` — enable/disable job

### Cron

- `POST /api/cron/scheduler` — Vercel cron, every minute, protected by `CRON_SECRET`

### Inbox extension

- `POST /api/inbox/[id]/approve-run` — approve and dispatch a missed scheduled run

All routes require authentication via `await auth()`.

## Calendar UX

### Page structure

New top-level route: `/schedule` under the `(dashboard)` route group.

- Route file: `src/app/(dashboard)/schedule/page.tsx` → renders `<SchedulePage />`
- Component: `src/components/schedule-page.tsx`
- Sidebar: add `{ id: "schedule", label: "Schedule", icon: "📅", href: "/schedule" }` to `navItems`
- Settings: add to `VALID_PAGES` and `PAGE_OPTIONS`

### Month view (default)

Full-width Google Calendar-style month grid:
- Top toolbar: month name, prev/next arrows, "Today" button, Month/Week toggle, "+ New Job" button
- 7-column grid (Sun–Sat) with day cells
- Each cell shows job pills (colored, truncated name) for jobs scheduled on that day
- Daily/hourly jobs render in every applicable cell
- Disabled/paused jobs shown with reduced opacity
- Today's cell highlighted
- Click a job pill → open edit modal
- Click empty space in a cell → open create modal pre-filled with that date

### Week view

7-column grid with time slots on the y-axis (hourly rows):
- Jobs render as time-positioned blocks at their scheduled hour
- Click a block → edit modal
- Click empty slot → create modal pre-filled with day + time
- Daily/hourly jobs render as recurring blocks across columns

### Job creation/edit modal

Centered modal dialog (matches existing `NewTaskDialog` pattern):
- **Name** — text input
- **Agent** — dropdown of existing AgentConfigs (optional, pre-fills tool/model/prompt)
- **Tool / Model** — cascading dropdowns (like agents page), shown if no agent selected or for override
- **Schedule preset** — pill selector: Once | Hourly | Daily | Weekly | Monthly
- **Conditional fields** based on preset:
  - Once: date + time picker
  - Hourly: (no additional fields)
  - Daily: time picker
  - Weekly: day-of-week + time picker
  - Monthly: day-of-month + time picker
- **Prompt** — textarea
- **Task mode** — pill toggle: "New task each run" | "Reuse task"
  - If "Reuse task": task selector dropdown (or create new)
- **Project** — dropdown (which project to create tasks in)
- **Save / Cancel** buttons
- **Delete** button (edit mode only, with confirmation)
- **Enable/Disable** toggle (edit mode only)

## Integration Points

### App state

- `scheduledJobs` added to AppContext
- `refreshSchedules()` callback in dashboard layout
- `fetchSchedules()` added to `api-client.ts`

### Agent deletion cascade

When deleting an AgentConfig that has associated ScheduledJobs:
- Block the deletion
- Show a dialog: "This agent is used by N scheduled jobs. Reassign or delete them."
- Per-job options: reassign to another agent (dropdown) or delete the job
- Agent deletion proceeds only after all jobs are handled

### Run tracing

AgentRun records created by scheduled jobs include `scheduledJobId` for provenance tracking.

### Job deletion cleanup

Deleting a ScheduledJob also dismisses any related pending InboxItems.

## Error Handling

- **Multiple missed runs:** Single InboxItem, message includes miss count (e.g., "missed 3 runs"). `nextRunAt` advances to next future occurrence to prevent flood.
- **One-time job in the past:** API validation rejects `scheduledAt` values in the past.
- **Deleted agent reference:** `agentConfigId` becomes dangling. Job still works via inline `tool`/`model` fields. Edit modal shows agent as "(deleted)".
- **Concurrent cron invocations:** Skip if `lastRunAt` is within last 55 seconds.
- **User deletes job with pending inbox:** InboxItems for that job are dismissed.

## Vercel Configuration

Add to `vercel.json`:

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

Add `CRON_SECRET` to Vercel environment variables.
