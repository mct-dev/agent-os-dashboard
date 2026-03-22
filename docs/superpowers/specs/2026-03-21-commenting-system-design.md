# Commenting System with @-Agent Mentions

## Overview

Add a commenting system to Agent OS Dashboard that supports threaded conversations on tasks, projects, and agent runs. Users can @-mention configured agents in comments to trigger automated responses via the bridge.

## Data Model

A single polymorphic `Comment` model attaches to tasks, projects, or runs.

```prisma
model Comment {
  id             String    @id @default(cuid())
  body           String    // markdown, may contain @AgentName mentions

  // Polymorphic parent — exactly one is set (enforced by CHECK constraint)
  taskId         String?
  task           Task?     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  projectId      String?
  project        Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agentRunId     String?
  agentRun       AgentRun? @relation("RunComments", fields: [agentRunId], references: [id], onDelete: Cascade)

  // Author — exactly one is set (enforced by CHECK constraint)
  userId         String?   // human user email
  agentId        String?   // AgentConfig.id that posted this

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([taskId])
  @@index([projectId])
  @@index([agentRunId])
}
```

Inverse relations to add on existing models:
- `Task.comments Comment[]`
- `Project.comments Comment[]`
- `AgentRun.comments Comment[] @relation("RunComments")`

### Existing model changes

**`AgentRun.taskId`** is currently required. For runs triggered by project-level or run-level @-mentions, there is no task context. Make `taskId` nullable:
```prisma
taskId    String?
task      Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
```
Update any code that assumes `taskId` is always present (queries, serializers).

**`AgentConfig.name`** must be unique to avoid ambiguous @-mention matching:
```prisma
model AgentConfig {
  ...
  name String @unique
}
```

### Triggered runs tracking

When a comment @-mentions agents, each mentioned agent gets its own run. Rather than a single `triggeredRunId` on Comment (which can't handle multiple mentions), track the link from the AgentRun side:

```prisma
model AgentRun {
  ...
  triggerCommentId  String?   // The comment that triggered this run
  triggerComment    Comment?  @relation(fields: [triggerCommentId], references: [id], onDelete: SetNull)
}
```

Add inverse on Comment: `triggeredRuns AgentRun[]`

This supports multiple @-mentions per comment naturally. The UI checks `comment.triggeredRuns` to show "thinking..." indicators.

## API Routes

### `GET /api/comments?taskId=X` (or `projectId=X` or `agentRunId=X`)

Returns comments for the given parent in chronological order. Include `triggeredRuns` with status for "thinking..." indicators. Auth: shared `authenticate` helper (API key + session).

### `POST /api/comments`

Request body:
```json
{
  "body": "Hey @DevBot can you review this?",
  "taskId": "clxyz..."
}
```

Server-side processing:
1. Validate: body is non-empty, exactly one parent ID is provided
2. Determine author: if session auth, set `userId`; if API key auth, require `agentId` in body
3. Persist the Comment
4. Parse @-mentions using regex `/\B@([^\s@,!?.]+)/g`
5. Match tokens (case-insensitive) against `AgentConfig.name` (unique constraint ensures no ambiguity)
6. For each matched agent:
   a. Resolve task context: if comment is on a task, use that task. If on a project or run, set `taskId` to null on the AgentRun.
   b. Build prompt (see Agent Wakeup Flow)
   c. Dispatch run to bridge: `POST {bridgeUrl}/api/runs`
   d. Create `AgentRun` in dashboard DB with `triggerCommentId` set
7. Return the created comment with `triggeredRuns` included

Auth for agent-authored comments: the auto-reply is created server-side by the completion webhook (see below), not via an HTTP request. This avoids the question of how an agent authenticates to create a comment — the server creates it directly via `prisma.comment.create`.

### `PUT /api/comments/[id]`

Update comment body. Only the original author can edit. Re-parses mentions but does not re-trigger agents.

### `DELETE /api/comments/[id]`

Delete comment. Only the original author can delete. Does not cancel any triggered runs.

### `POST /api/runs/[runId]/complete` (new webhook)

Called by the bridge when a run reaches terminal status. This is a **server-to-server callback**, not client-driven.

Processing:
1. Auth: API key (same `ICARUS_API_KEY`)
2. Update `AgentRun`: set `status`, `endedAt`, `output` from request body
3. Check if `triggerCommentId` is set on the run
4. If so, create a reply Comment:
   - `body`: the run's output (trimmed/formatted)
   - `agentId`: the agent that ran
   - Same parent (taskId/projectId/agentRunId) as the trigger comment
   - `userId`: null (agent-authored)
5. Return `{ ok: true }`

This replaces the unreliable SSE-based completion detection for auto-replies. The SSE stream continues to work for live output viewing, but auto-reply creation is decoupled from client connections.

Bridge-side change: add a `callback_url` parameter to `POST /api/runs`. When the run completes, the bridge POSTs to `{callback_url}` with `{ status, output }`. This is a small addition to `bridge/src/claude-adapter.ts`.

## Agent Wakeup Flow

End-to-end when a user posts `@DevBot can you review this approach?` on a task:

1. `POST /api/comments` saves comment with `taskId` and `userId`
2. Server regex-parses "DevBot" from the body
3. Matches against `AgentConfig` table (unique name, case-insensitive)
4. Looks up agent's `model`, `systemPrompt`, `tool`
5. Builds the bridge run prompt:
   ```
   You are {agentName}. {agentSystemPrompt}

   You were mentioned in a comment on task "{taskTitle}".
   Task description: {taskDescription}

   Comment thread (chronological):
   {for each comment: "[author] at [time]: [body]"}

   The comment that mentioned you:
   [{userName}]: {commentBody}

   Respond to the mention. Be concise and helpful.
   ```
6. `POST {bridgeUrl}/api/runs` with task context, prompt, model, and `callback_url`
7. Creates `AgentRun` record with `triggerCommentId` set to the comment
8. Bridge spawns the agent (existing `spawnClaudeRun`)
9. Run completes — bridge POSTs to `callback_url` (`POST /api/runs/[runId]/complete`)
10. Completion webhook creates a reply Comment with `agentId` set and run output as body

For project-level @-mentions: same flow but `AgentRun.taskId` is null and the prompt references the project instead of a task.

For run-level @-mentions: same flow but the prompt includes the run's output/status as additional context.

## UI Components

### CommentThread

Reusable component accepting `taskId`, `projectId`, or `agentRunId` prop.

- Fetches comments for the given parent via `GET /api/comments?{parent}Id={id}`
- Renders flat chronological list
- Each comment displays:
  - Author icon: user avatar or robot icon for agents
  - Author name and timestamp
  - Markdown-rendered body (sanitized — use `react-markdown` with `rehype-sanitize` to prevent XSS)
  - If comment has `triggeredRuns` with any in RUNNING/PENDING status: "thinking..." indicator per agent
- Agent-authored comments have a subtle visual distinction (tinted background, robot icon)
- Polls for new comments periodically (every 5s) or on focus, to pick up agent replies

### CommentInput

Text area at the bottom of the CommentThread.

- Plain textarea (not rich text) with submit button
- @-mention autocomplete: when user types `@`, show a dropdown of configured agents filtered by the typed prefix
- On submit: POST to `/api/comments`, optimistically add to the thread
- Mention autocomplete implementation: track cursor position, detect `@` prefix, query agents from app state, render floating dropdown

### @-Mention Autocomplete

- Triggered when `@` is typed (not preceded by a word character)
- Floating dropdown positioned below the textarea (not cursor-positioned, to keep it simple)
- Shows agent name + icon for each match
- Selecting inserts `@AgentName` into the textarea
- Escape or clicking away dismisses
- Agents sourced from `useAppState().agents` (already loaded)

### Integration Points

- **TaskPanel** (`task-panel.tsx`): Add CommentThread as a section below run history. Comments fetched with `taskId`.
- **ProjectsPage** (`projects-page.tsx`): Add expandable comment section per project, or a project detail view with CommentThread using `projectId`.
- **Run detail** (within TaskPanel): Each completed run shows a collapsible CommentThread using `agentRunId`.

## Migration

Single SQL migration creating the `Comment` table, modifying `AgentRun`, and adding constraints:

```sql
-- Make AgentRun.taskId nullable
ALTER TABLE "AgentRun" ALTER COLUMN "taskId" DROP NOT NULL;

-- Add trigger comment link to AgentRun
ALTER TABLE "AgentRun" ADD COLUMN "triggerCommentId" TEXT;

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

-- Indexes
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");
CREATE INDEX "Comment_agentRunId_idx" ON "Comment"("agentRunId");

-- Foreign keys on Comment
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_agentRunId_fkey"
    FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key on AgentRun.triggerCommentId
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_triggerCommentId_fkey"
    FOREIGN KEY ("triggerCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints for data integrity
ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_parent"
    CHECK (num_nonnulls("taskId", "projectId", "agentRunId") = 1);
ALTER TABLE "Comment" ADD CONSTRAINT "comment_exactly_one_author"
    CHECK (num_nonnulls("userId", "agentId") = 1);
```

## Scope Boundaries

**In scope:**
- Comment CRUD on tasks, projects, and runs
- @-mention parsing and agent wakeup via bridge
- Auto-posting agent replies via completion webhook
- @-mention autocomplete in the comment input
- Flat chronological thread (no nesting)
- XSS-safe markdown rendering
- CHECK constraints for data integrity
- Bridge completion callback (`POST /api/runs/[runId]/complete`)

**Out of scope (future):**
- File attachments on comments
- Reactions/emoji on comments
- Real-time streaming of agent responses into the thread
- Edit history / audit log
- Rich text editing (keep it markdown in a textarea)
- Notification system beyond the existing inbox
