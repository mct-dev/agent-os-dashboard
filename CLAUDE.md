@AGENTS.md

# agent-os Dashboard

Task/issue management dashboard with AI agent execution capabilities.

## Tech Stack

- **Framework:** Next.js 16 (app router), React 19, TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma 6
- **Auth:** NextAuth v5 beta, Google OAuth (email allowlist)
- **UI:** Tailwind CSS 4, DaisyUI 5, shadcn/ui (Radix), Lucide icons
- **State:** React Context (`src/lib/store.ts`)
- **Notifications:** sonner toasts
- **Bridge:** Separate Express server (`bridge/`) for spawning agent processes (Claude Code, Codex)

## Project Structure

```
src/
  app/(dashboard)/       # Dashboard pages (board, schedule, etc.)
  app/api/               # Next.js API routes
  app/setup/             # Onboarding wizard
  components/            # React components (pages + shared)
  lib/                   # Utilities: types, api-client, store, auth, prisma
bridge/                  # Express server for agent execution (port 4242)
prisma/                  # Schema + migrations
docs/                    # Specs and plans
```

## Key Patterns

### API Routes
- Session-only auth for user-facing routes: `const session = await auth()`
- Dual auth (session + API key) for routes the bridge calls: `await authenticate(req)` from `@/lib/api-helpers`
- API key is `ICARUS_API_KEY` env var, passed via `x-api-key` header
- Next.js 16: route params are `Promise` — always `await params`

### Data Flow
- `src/lib/api-client.ts` — all client-side fetch functions
- `src/lib/types.ts` — shared TypeScript interfaces
- `src/lib/store.ts` — React Context with `useAppState()` hook
- `src/lib/api-helpers.ts` — `serializeTask()` converts Prisma DateTime to ISO strings; update this when adding relations to Task

### Frontend
- Components use DaisyUI classes (`btn`, `badge`, `card`, `input`) mixed with shadcn/ui (`Dialog`, `Select`, `Sheet`)
- Optimistic UI updates with rollback on error
- `toast` from sonner for all user notifications

### Agent Execution
- Runs dispatched via `POST /api/runs` → bridge `POST /api/runs`
- Bridge spawns Claude Code with `--resume` for session continuity
- Real-time output via WebSocket relay or SSE polling fallback
- Linked Linear tickets are auto-injected into agent prompts

## Database / Prisma

### Migrations
- **NEVER run `prisma migrate dev` against production.** Use `prisma migrate deploy` only.
- **Do NOT run migrations locally against the production database.** Migrations are auto-applied during Vercel builds via the build script: `prisma generate && prisma migrate deploy && next build`.
- **Do NOT mark migrations as applied with `prisma migrate resolve --applied` unless the SQL was actually executed.** This causes the migration tracker to think tables exist when they don't, leading to runtime P2021/P2022 errors.
- When creating migrations locally, use `npx prisma migrate dev --name <name>` which runs against your local/dev database.
- The `DIRECT_URL` env var must use a session-mode pooler (port 5432) — transaction-mode poolers (port 6543) don't support migrations.

### Schema Conventions
- All models have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- IDs are `String @id @default(cuid())`
- Foreign keys use `onDelete: Cascade` for child records, `onDelete: SetNull` for optional references
- When adding a new relation to Task, also update `serializeTask()` in `api-helpers.ts` and add `include` to task queries in `api/tasks/route.ts` and `api/tasks/[id]/route.ts`

## Environment Variables

### Dashboard (.env.local)
- `DATABASE_URL` — Supabase transaction pooler (port 6543)
- `DIRECT_URL` — Supabase session pooler (port 5432, used for migrations)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ICARUS_API_KEY` — shared secret for bridge ↔ dashboard auth

### Bridge (bridge/.env)
- `BRIDGE_API_KEY` — must match what user configures in dashboard settings
- `PORT` — default 4242
