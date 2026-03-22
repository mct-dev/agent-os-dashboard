# Agent OS - Implementation TODO

## Phase 1 - MVP Core

### 1A: Database-backed Task CRUD
- [x] Add `IN_REVIEW` to Prisma `Status` enum
- [x] Create session-auth'd task API routes (`/api/tasks/[id]` for PUT/DELETE)
- [x] Update `/api/tasks` GET to support session auth (dual: API key + session)
- [x] Map `projectId` (frontend) <-> `project` enum (Prisma) -- SUPERSEDED by Project table
- [x] Wire dashboard to fetch tasks from Supabase on mount
- [x] Wire task creation (NewTaskDialog) to POST /api/tasks
- [x] Wire task editing (TaskPanel) to PUT /api/tasks/[id]
- [x] Wire task deletion to DELETE /api/tasks/[id]
- [x] Wire kanban drag-drop status changes to persist via API

### 1B: Agent Dispatch + Streaming
- [x] Add `/api/runs` POST route to proxy run creation to bridge
- [x] Add run dispatch UI (model picker, prompt input) in TaskPanel
- [x] Wire SSE streaming: bridge WebSocket -> Next.js SSE -> frontend (with polling fallback)
- [x] Display real-time streaming output in TaskPanel run section
- [x] Wire Stop button to cancel running agent via bridge
- [x] Create AgentRun records in Supabase when runs start/complete
- [x] Upgrade SSE from polling to WebSocket relay (with polling fallback)

### 1C: DB-backed Projects, Agents, SOPs, Inbox
- [x] Migrate Task.project enum to Project table with FK
- [x] Create Project, Sop, SopStage, AgentConfig, InboxItem Prisma models
- [x] Seed default projects, SOPs, and agents in migration
- [x] CRUD API routes for all entities (/api/projects, /api/agents, /api/sops, /api/inbox)
- [x] Wire all frontend pages to fetch from DB instead of mock data
- [x] Wire all CRUD operations through API (projects, agents, SOPs, inbox)
- [x] Remove mock data dependency (mock-data.ts gutted)
- [x] Replace SOPS constant imports with context-provided data

### 1D: UX Polish
- [x] Bridge status indicator in kanban board header (green/red dot)
- [ ] Empty state messaging when DB has no tasks yet
- [ ] Loading skeleton while data fetches
- [ ] Error boundary for failed API calls

### 1E: Icarus API
- [x] `/api/tasks` POST works with ICARUS_API_KEY
- [x] `/api/inbox` POST works with ICARUS_API_KEY (bridge callbacks)

## Pending DB Migration

The following SQL must be run in Supabase SQL Editor before deploying:
- Migration 1: `prisma/migrations/20260320_add_in_review_and_run_fields/migration.sql`
- Migration 2: `prisma/migrations/20260320_add_project_agent_sop_inbox_tables/migration.sql`

Run them in order. Migration 2 creates new tables and migrates Task.project enum to FK.

## Tech Debt
- [ ] Rename `ICARUS_API_KEY` to something descriptive (e.g., `DASHBOARD_API_KEY` or `INTERNAL_API_KEY`). Currently used as the shared secret for bridge↔dashboard auth (`x-api-key` header) and run completion callbacks. Referenced in: `.env.local`, Vercel env vars, `api-helpers.ts` `authenticate()`, `runs/callback/route.ts`, and bridge `.env` docs. The name is a holdover from early development and confuses new readers.

## Phase 2 - SOP Engine (deferred)
- [ ] Multi-step orchestration (sequential stage execution)
- [ ] Sub-agent spawning per stage
- [ ] BMAD-style phase artifacts

## Phase 3 - Observability + Cost (deferred)
- [ ] Token counting + cost per run
- [ ] Budget limits + auto-stop
- [ ] Run history browser
- [ ] Chat/interrupt mid-run
- [ ] Daily/weekly spend dashboard
