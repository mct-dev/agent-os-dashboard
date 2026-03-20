# Spec: Phase 1A - Database-backed Task CRUD

## Overview
Wire the existing UI (kanban board, task panel, new task dialog) to Supabase via Prisma instead of mock data.

## Schema Change
Add `IN_REVIEW` to the Prisma `Status` enum:
```prisma
enum Status {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
  BLOCKED
}
```

## API Routes

### GET /api/tasks (dual auth)
- If `x-api-key` header matches ICARUS_API_KEY: external API access (Telegram)
- If session present (NextAuth): dashboard access
- Returns tasks with runs, maps Prisma enums to lowercase for frontend
- Supports `?project=` filter

### POST /api/tasks (dual auth)
- Same dual auth as GET
- Accepts: `{ title, description?, projectId?, priority?, sopId? }`
- Maps `projectId` ("laurel") to Prisma enum ("LAUREL")
- Returns created task

### PUT /api/tasks/[id] (session auth only)
- Accepts partial updates: `{ title?, description?, status?, priority?, projectId?, sopId? }`
- Maps enums both directions
- Returns updated task

### DELETE /api/tasks/[id] (session auth only)
- Cascading delete (task + runs)
- Returns `{ ok: true }`

## Frontend Changes

### page.tsx
- Fetch tasks from `/api/tasks` on mount instead of using MOCK_TASKS
- Keep projects, agents, sops, inbox as local state (not DB-backed yet)

### new-task-dialog.tsx
- POST to `/api/tasks` instead of local state append
- Refresh task list after creation

### task-panel.tsx
- Debounced PUT to `/api/tasks/[id]` on field changes
- Or explicit save button

### kanban-board.tsx
- On drag end: PUT status change to `/api/tasks/[id]`
- Optimistic update with rollback on failure

### task-card.tsx
- Delete: call DELETE `/api/tasks/[id]` then remove from state

## Data Mapping
```
Frontend projectId  <->  Prisma Project enum
"laurel"            <->  LAUREL
"personal"          <->  PERSONAL
"side"              <->  SIDE
"life"              <->  LIFE
```

Frontend `Task.projectId` maps to Prisma `Task.project`.
API response transforms: `{ ...task, projectId: task.project.toLowerCase(), project: undefined }`.
API request transforms: `{ ...body, project: body.projectId?.toUpperCase() }`.
