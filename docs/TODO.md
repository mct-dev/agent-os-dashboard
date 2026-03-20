# Agent OS - Implementation TODO

## Phase 1 - MVP Core

### 1A: Database-backed Task CRUD
- [x] Add `IN_REVIEW` to Prisma `Status` enum (frontend has it, DB doesn't)
- [x] Create session-auth'd task API routes (`/api/tasks/[id]` for PUT/DELETE)
- [x] Update `/api/tasks` GET to support session auth (not just ICARUS_API_KEY)
- [x] Map `projectId` (frontend: "laurel") <-> `project` enum (Prisma: "LAUREL")
- [x] Wire dashboard to fetch tasks from Supabase on mount
- [x] Wire task creation (NewTaskDialog) to POST /api/tasks
- [x] Wire task editing (TaskPanel) to PUT /api/tasks/[id]
- [x] Wire task deletion to DELETE /api/tasks/[id]
- [x] Wire kanban drag-drop status changes to persist via API

### 1B: Agent Dispatch + Streaming
- [x] Add `/api/runs` POST route to proxy run creation to bridge
- [x] Add run dispatch UI (model picker, prompt input) in TaskPanel
- [x] Wire SSE streaming: bridge WebSocket -> Next.js SSE -> frontend
- [x] Display real-time streaming output in TaskPanel run section
- [x] Wire Stop button to cancel running agent via bridge
- [x] Create AgentRun records in Supabase when runs start/complete

### 1C: Icarus API Enhancement
- [x] `/api/tasks` POST already works with ICARUS_API_KEY
- [x] Add response format docs for Telegram bot integration

## Phase 2 - SOP Engine (deferred)
## Phase 3 - Observability + Cost (deferred)
