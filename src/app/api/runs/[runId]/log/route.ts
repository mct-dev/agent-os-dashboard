import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = await params

  // Look up the AgentRun to get the bridgeRunId
  const run = await prisma.agentRun.findUnique({ where: { id: runId } })
  if (!run?.bridgeRunId) {
    return NextResponse.json({ error: "Run not found or no bridge run ID" }, { status: 404 })
  }

  // Get bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })
  if (!settings?.bridgeUrl) {
    return NextResponse.json({ error: "Bridge not configured" }, { status: 400 })
  }

  try {
    const base = settings.bridgeUrl.replace(/\/+$/, "")
    const res = await fetch(`${base}/api/runs/${run.bridgeRunId}/log`, {
      headers: { "x-api-key": settings.bridgeApiKey || "" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Bridge returned ${res.status}` }, { status: 502 })
    }

    const logs = await res.json()
    return NextResponse.json(logs)
  } catch {
    return NextResponse.json({ error: "Failed to reach bridge" }, { status: 502 })
  }
}
