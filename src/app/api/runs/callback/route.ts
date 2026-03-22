import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { bridgeRunId, status, output, api_key } = await req.json()

  // Authenticate via ICARUS_API_KEY
  const expectedKey = process.env.ICARUS_API_KEY
  if (!expectedKey || api_key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!bridgeRunId || !status) {
    return NextResponse.json({ error: "bridgeRunId and status required" }, { status: 400 })
  }

  const prismaStatus = status === "completed" ? "COMPLETED" : status === "failed" ? "FAILED" : "STOPPED"

  const run = await prisma.agentRun.findFirst({
    where: { bridgeRunId },
  })

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: prismaStatus,
      endedAt: new Date(),
      output: output ? String(output).slice(0, 50_000) : null,
    },
  })

  // Update task status based on run outcome
  if (run.taskId) {
    const taskStatus = prismaStatus === "COMPLETED" ? "DONE" : prismaStatus === "FAILED" ? "BLOCKED" : undefined
    if (taskStatus) {
      await prisma.task.update({
        where: { id: run.taskId },
        data: { status: taskStatus },
      }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
