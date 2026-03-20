import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const POLL_INTERVAL_MS = 500
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "STOPPED"])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = await params

  // Get the AgentRun from DB
  const run = await prisma.agentRun.findUnique({ where: { id: runId } })
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // Get user's bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl || !run.bridgeRunId) {
    // Return a minimal stream that just sends current status
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }
        send({ type: "connected", runId })
        send({ type: "status", status: run.status.toLowerCase() })
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")
  const bridgeApiKey = settings.bridgeApiKey ?? ""
  const bridgeRunId = run.bridgeRunId
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller may already be closed
        }
      }

      send({ type: "connected", runId })

      let aborted = false
      req.signal.addEventListener("abort", () => {
        aborted = true
      })

      // Try WebSocket relay first, fall back to polling on failure
      const wsConnected = await tryWebSocketRelay(
        bridgeUrl,
        bridgeRunId,
        runId,
        send,
        controller,
        req.signal
      )

      if (!wsConnected && !aborted) {
        // Fall back to polling
        await pollBridgeLogs(
          bridgeUrl,
          bridgeApiKey,
          bridgeRunId,
          runId,
          send,
          controller,
          req.signal
        )
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Attempt to relay events via WebSocket from the bridge.
 * Returns true if WebSocket connected successfully, false to signal fallback to polling.
 */
async function tryWebSocketRelay(
  bridgeUrl: string,
  bridgeRunId: string,
  runId: string,
  send: (data: object) => void,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal
): Promise<boolean> {
  const wsUrl =
    bridgeUrl.replace(/^https?/, (m) => (m === "https" ? "wss" : "ws")) +
    "/api/events/ws"

  return new Promise<boolean>((resolve) => {
    let resolved = false
    let ws: WebSocket

    try {
      ws = new WebSocket(wsUrl)
    } catch {
      resolve(false)
      return
    }

    // If the WS doesn't connect within 5s, fall back
    const connectTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        try { ws.close() } catch { /* ignore */ }
        resolve(false)
      }
    }, 5000)

    // Handle client disconnect
    const onAbort = () => {
      try { ws.close() } catch { /* ignore */ }
      if (!resolved) {
        resolved = true
        clearTimeout(connectTimeout)
        resolve(true)
      }
      try { controller.close() } catch { /* ignore */ }
    }
    signal.addEventListener("abort", onAbort)

    ws.onopen = () => {
      clearTimeout(connectTimeout)
      if (!resolved) {
        resolved = true
        resolve(true)
      }
      ws.send(JSON.stringify({ type: "subscribe", runId: bridgeRunId }))
    }

    ws.onmessage = (event) => {
      if (signal.aborted) return
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : String(event.data))
        if (msg.type === "run.log" && msg.runId === bridgeRunId) {
          send({
            type: "log",
            ts: msg.ts ?? Date.now(),
            stream: msg.stream ?? "stdout",
            chunk: msg.chunk ?? "",
          })
        } else if (msg.type === "run.status" && msg.runId === bridgeRunId) {
          const normalizedStatus = (msg.status ?? "").toUpperCase()
          send({ type: "status", status: msg.status })
          if (TERMINAL_STATUSES.has(normalizedStatus)) {
            // Update DB record
            prisma.agentRun
              .update({
                where: { id: runId },
                data: {
                  status: normalizedStatus as "COMPLETED" | "FAILED" | "STOPPED",
                  endedAt: new Date(),
                },
              })
              .catch(() => {})
            try { ws.close() } catch { /* ignore */ }
            try { controller.close() } catch { /* ignore */ }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onerror = () => {
      clearTimeout(connectTimeout)
      if (!resolved) {
        resolved = true
        resolve(false)
      }
    }

    ws.onclose = () => {
      clearTimeout(connectTimeout)
      signal.removeEventListener("abort", onAbort)
      if (!resolved) {
        resolved = true
        resolve(false)
      }
      // If the WS closes after successfully connecting, close the SSE stream
      // (unless the controller is already closed)
      try { controller.close() } catch { /* ignore */ }
    }
  })
}

/**
 * Polling fallback: repeatedly fetch logs and status from the bridge REST API.
 */
async function pollBridgeLogs(
  bridgeUrl: string,
  bridgeApiKey: string,
  bridgeRunId: string,
  runId: string,
  send: (data: object) => void,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal
) {
  let lastSeenIndex = 0

  while (!signal.aborted) {
    try {
      const logRes = await fetch(
        `${bridgeUrl}/api/runs/${bridgeRunId}/log`,
        {
          headers: { "x-api-key": bridgeApiKey },
        }
      )

      if (!logRes.ok) {
        send({ type: "error", message: `Bridge returned ${logRes.status}` })
        break
      }

      const logData = await logRes.json()
      const entries = Array.isArray(logData) ? logData : logData.entries ?? []

      // Send only new entries
      for (let i = lastSeenIndex; i < entries.length; i++) {
        const entry = entries[i]
        send({
          type: "log",
          ts: entry.ts ?? entry.timestamp ?? Date.now(),
          stream: entry.stream ?? "stdout",
          chunk: entry.chunk ?? entry.text ?? entry.content ?? "",
        })
      }
      lastSeenIndex = entries.length

      // Check run status via separate endpoint (log endpoint returns plain array)
      const statusRes = await fetch(
        `${bridgeUrl}/api/runs/${bridgeRunId}`,
        { headers: { "x-api-key": bridgeApiKey } }
      )
      if (statusRes.ok) {
        const runData = await statusRes.json()
        const bridgeStatus = (runData.status ?? "").toUpperCase()
        if (TERMINAL_STATUSES.has(bridgeStatus)) {
          send({ type: "status", status: bridgeStatus.toLowerCase() })
          // Update our DB record
          await prisma.agentRun
            .update({
              where: { id: runId },
              data: {
                status: bridgeStatus as "COMPLETED" | "FAILED" | "STOPPED",
                endedAt: new Date(),
              },
            })
            .catch(() => {})
          break
        }
      }
    } catch (err: unknown) {
      if (!signal.aborted) {
        const message =
          err instanceof Error ? err.message : "Unknown polling error"
        send({ type: "error", message })
      }
      break
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  try { controller.close() } catch { /* ignore */ }
}
