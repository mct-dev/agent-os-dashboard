# Linear Integration Design

Connect Linear accounts and import/link Linear issues to agent-os tasks, providing agents with ticket context during execution.

## Authentication

Users connect Linear via a personal API key entered in the Settings page. The key is stored in the `UserSettings` table (new `linearApiKey` field), matching the existing bridge API key pattern. All Linear API calls are proxied server-side through Next.js API routes — the key never reaches the client.

## Data Model

### UserSettings (existing — add field)

| Field | Type | Notes |
|-------|------|-------|
| `linearApiKey` | `String?` | Personal Linear API key |

### LinearLink (new model)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | cuid, primary key |
| `taskId` | `String` | FK → Task (onDelete: Cascade) |
| `linearIssueId` | `String` | Linear's UUID |
| `linearIssueUrl` | `String` | Full URL to Linear issue |
| `linearTeamKey` | `String` | e.g., "ENG" |
| `linearIssueNumber` | `Int` | e.g., 142 |
| `linearTitle` | `String` | Snapshot, refreshable |
| `linearStatus` | `String?` | Snapshot, refreshable |
| `linearPriority` | `Int?` | Snapshot, refreshable (Linear's 0-4 scale) |
| `linearAssignee` | `String?` | Snapshot, refreshable |
| `syncedAt` | `DateTime` | Last time we fetched from Linear |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | @updatedAt (schema convention) |

Constraints: `@@unique([taskId, linearIssueId])` to prevent duplicate links.

Relationship: A Task can have many LinearLinks (one-to-many).

Title, status, priority, and assignee are snapshots captured at link time. They are not auto-synced but can be refreshed on demand.

## API Routes

### Linear Connection

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/linear/status` | Check if API key is configured and valid |
| `POST` | `/api/linear/connect` | Save Linear API key to UserSettings |

### Linear Search (server-side proxy)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/linear/search?q=...&teamId=...&status=...` | Search Linear issues |
| `GET` | `/api/linear/teams` | List user's Linear teams for filter dropdowns |

### Linear Links (CRUD)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/tasks/[id]/linear-links` | List links for a task |
| `POST` | `/api/tasks/[id]/linear-links` | Link a Linear issue to a task |
| `DELETE` | `/api/tasks/[id]/linear-links/[linkId]` | Unlink |
| `POST` | `/api/tasks/[id]/linear-links/sync` | Refresh all linked ticket data from Linear |

### Import

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/linear/import` | Create tasks from Linear issues. Takes array of Linear issue IDs (max 50) + optional `projectId`. Creates tasks with title/description copied from Linear, creates LinearLinks automatically. Description is copied as raw Markdown, truncated to 10,000 chars. |

## Agent Context Injection

When a run is dispatched via `POST /api/runs`, before sending to the bridge:

1. Query `LinearLink` records for the task.
2. If any exist, append a structured context block to the prompt:

```
---
LINKED LINEAR TICKETS:
- ENG-142: "Fix auth token refresh" (In Progress) — https://linear.app/team/ENG-142
- ENG-155: "Update OAuth scopes" (Todo) — https://linear.app/team/ENG-155

These Linear tickets are linked to this task. Refer to them for additional context.
If you have access to Linear via MCP, you can query them for real-time details.
---
```

This is injected automatically. The agent sees ticket IDs/URLs and can use Linear MCP to dig deeper if available on the user's machine.

LinearLink lookup failures MUST NOT block run dispatch. If the query fails, proceed without Linear context and log a warning.

## UI Design

### 1. Settings Page — Linear Section

New section below Bridge configuration:
- Linear logo + "Linear" heading + connection status badge (Connected/Not Connected)
- API key input (masked, like bridge API key)
- "Test" button to validate the key
- On successful connection, display workspace name and user email

### 2. Kanban Header — Import Button

"Import from Linear" button with Linear logo icon, placed alongside existing controls in the kanban board header. Styled with Linear's brand purple (#5E6AD2). Only visible when Linear is connected.

### 3. Import Modal — Search & Browse

Full-screen modal with:
- **Search bar**: Text search across Linear issues
- **Filters**: Team dropdown, status dropdown
- **Results list**: Checkbox selection, showing ticket ID (colored), title, and status badge
- **Footer**: Project assignment dropdown ("No project" default) + "Import N Issues" button
- Imported issues become new agent-os tasks with LinearLinks automatically created

### 4. Kanban Card — Hybrid Display

When a task has linked Linear issues:
- Show the first ticket ID as a purple badge (e.g., `ENG-142`)
- If more than one, show "+N more" text after the badge
- Clicking opens the task panel

### 5. Task Panel — Linked Linear Issues Section

Dedicated section in the task detail panel:
- Header: "Linked Linear Issues" + "+ Link Issue" button
- List of linked tickets: ID (purple), title, status badge, unlink (✕) button
- Each ticket ID is a clickable link to Linear
- Footer: "Synced N min ago" timestamp + "Refresh" button
- "+ Link Issue" opens a search modal (same search UI as import, but links to existing task instead of creating new ones)

### Linear Logo

Official Linear logomark SVG:

```svg
<svg width="20" height="20" viewBox="0 0 100 100" fill="currentColor">
  <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465915 2.2686-.77832 4.5932-.92588465 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3367c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1855ZM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z"/>
</svg>
```

## Data Loading

The `GET /api/tasks` response includes a lightweight `linearLinks` array on each task (just `id`, `linearTeamKey`, `linearIssueNumber`, `linearIssueUrl`) to support kanban badge display without a separate fetch per card. Full link details are loaded in the task panel view.

## Auth Pattern

`/api/linear/*` routes use session-only auth (matching `/api/user-settings`). `/api/tasks/[id]/linear-links/*` routes use the `authenticate()` helper (session + API key) since the run dispatch path needs to read links for context injection.

## Technical Notes

- **Linear API client**: Use `@linear/sdk` npm package or raw GraphQL fetch to Linear's API (`https://api.linear.app/graphql`).
- **Search**: Linear's `issueSearch` GraphQL query supports text search. Team and status filters via GraphQL variables.
- **No bidirectional sync**: Data is copied at import/link time. On-demand refresh updates snapshots. No webhooks.
- **Future enhancement**: Saved filters for quick re-import (deferred).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | API key | Matches existing pattern (bridge API key), simplest to implement |
| Data strategy | Copy & link | Agents get immediate context without runtime Linear API calls |
| Sync model | On-demand refresh | Avoids webhook complexity, user controls when data updates |
| Card display | Hybrid (first ID + count) | Balances information density with card space |
| Import entry point | Kanban header button | Discoverable, doesn't complicate existing new-issue flow |
| Agent context | Auto-injected in prompt | Transparent to user, agents can use MCP for more detail |
| API key storage | Plaintext in DB | Matches existing bridgeApiKey pattern. Accepted risk — single-tenant app with auth-gated access. |
| Tenant model | Single-tenant | LinearLinks inherit task ownership scoped by session auth. No per-row user filtering. |
