# Spec: Phase 1B - Agent Dispatch + SSE Streaming

## Overview
Wire the "Start Run" button to dispatch agent runs via the bridge, stream output in real-time, and support cancellation.

## API Routes

### POST /api/runs (session auth)
Proxies run creation to the bridge server.
1. Get user's bridge settings from DB
2. POST to `{bridgeUrl}/api/runs` with bridge API key
3. Create AgentRun record in Supabase (status: PENDING)
4. Return `{ runId, bridgeRunId }`

Request body:
```json
{
  "taskId": "cuid",
  "model": "anthropic/claude-opus-4-6",
  "prompt": "user's prompt text"
}
```

### GET /api/runs/[runId]/stream (session auth)
SSE endpoint that:
1. Connects to bridge WebSocket (`{bridgeUrl}/api/events/ws`)
2. Subscribes to the run's output
3. Forwards log entries as SSE events
4. On completion: updates AgentRun status in Supabase

SSE event format:
```
data: {"type":"log","chunk":"text output here","stream":"stdout"}
data: {"type":"status","status":"running"}
data: {"type":"done","status":"completed","exitCode":0}
```

### POST /api/runs/[runId]/stop (session auth)
1. Get bridge settings
2. POST to `{bridgeUrl}/api/runs/{bridgeRunId}/cancel`
3. Update AgentRun status to STOPPED in Supabase

## Frontend Changes

### task-panel.tsx - Run Dispatch
Replace the static "Start Run" button with a run dispatch section:
- Model dropdown (from available models)
- Prompt textarea (pre-filled with task title + description)
- "Run" button that calls POST /api/runs
- Shows streaming output when run is active

### task-panel.tsx - Streaming Output
When a run is RUNNING:
- Connect to `/api/runs/[runId]/stream` via EventSource
- Display output in a terminal-like container (monospace, dark bg)
- Auto-scroll to bottom
- Show token count / cost if available

### task-panel.tsx - Stop Button
- Wire to POST `/api/runs/[runId]/stop`
- Optimistic UI update (show STOPPING state)

### task-card.tsx - Quick Run
- Wire the hover "Run" button to dispatch with default agent/model

## Bridge Integration
The bridge already supports:
- `POST /api/runs` - create run (returns runId)
- `GET /api/runs/:id` - get run status
- `POST /api/runs/:id/cancel` - cancel run
- WebSocket at `/api/events/ws` - real-time log streaming
- `GET /api/runs/:id/log` - get persisted log

The Next.js app proxies all bridge communication (frontend never talks to bridge directly).
