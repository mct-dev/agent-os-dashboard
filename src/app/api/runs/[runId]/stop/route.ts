import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function POST(
  _req: NextRequest,
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

  if (run.status !== "RUNNING" && run.status !== "PENDING") {
    return NextResponse.json(
      { error: `Run is already ${run.status.toLowerCase()}` },
      { status: 400 }
    )
  }

  // Get user's bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 400 }
    )
  }

  // Send cancel request to bridge if we have a bridgeRunId
  if (run.bridgeRunId) {
    const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      await fetch(`${bridgeUrl}/api/runs/${run.bridgeRunId}/cancel`, {
        method: "POST",
        headers: {
          "x-api-key": settings.bridgeApiKey ?? "",
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)
    } catch {
      // Log but don't fail - we still update our DB status
      console.error(`Failed to send cancel to bridge for run ${run.bridgeRunId}`)
    }
  }

  // Update AgentRun status to STOPPED
  const updated = await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "STOPPED", endedAt: new Date() },
  })

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    endedAt: updated.endedAt?.toISOString() ?? null,
  })
}
