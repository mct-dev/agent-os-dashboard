import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const POLL_INTERVAL_MS = 500
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "STOPPED"])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getSession()
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

  let lastSeenIndex = 0
  let aborted = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: "connected", runId })

      // Listen for client disconnect
      req.signal.addEventListener("abort", () => {
        aborted = true
      })

      // Poll bridge log endpoint
      while (!aborted) {
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
              await prisma.agentRun.update({
                where: { id: runId },
                data: { status: bridgeStatus as "COMPLETED" | "FAILED" | "STOPPED", endedAt: new Date() },
              }).catch(() => {})
              break
            }
          }
        } catch (err: unknown) {
          if (!aborted) {
            const message =
              err instanceof Error ? err.message : "Unknown polling error"
            send({ type: "error", message })
          }
          break
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }

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
