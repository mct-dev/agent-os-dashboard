import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params

  const runs = await prisma.agentRun.findMany({
    where: { scheduledJobId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      task: { select: { id: true, title: true, status: true } },
    },
  })

  return NextResponse.json(
    runs.map((r) => ({
      id: r.id,
      status: r.status,
      model: r.model,
      startedAt: r.startedAt?.toISOString() ?? null,
      endedAt: r.endedAt?.toISOString() ?? null,
      costUsd: r.costUsd,
      tokenCount: r.tokenCount,
      task: r.task ? { id: r.task.id, title: r.task.title, status: r.task.status } : null,
    }))
  )
}
