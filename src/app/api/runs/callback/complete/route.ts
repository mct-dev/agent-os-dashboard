import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  const body = await req.json()
  const { bridgeRunId, status, output, api_key } = body

  const validKey = process.env.ICARUS_API_KEY
  if (apiKey !== validKey && api_key !== validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!bridgeRunId || !status) {
    return NextResponse.json(
      { error: "bridgeRunId and status required" },
      { status: 400 }
    )
  }

  const run = await prisma.agentRun.findFirst({ where: { bridgeRunId } })
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  const mappedStatus =
    status === "completed"
      ? "COMPLETED"
      : status === "failed"
        ? "FAILED"
        : status === "stopped"
          ? "STOPPED"
          : status.toUpperCase()

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: mappedStatus,
      output: output ?? null,
      endedAt: new Date(),
    },
  })

  // Auto-post agent reply if triggered by a comment
  if (run.triggerCommentId && output && mappedStatus === "COMPLETED") {
    const triggerComment = await prisma.comment.findUnique({
      where: { id: run.triggerCommentId },
    })
    if (triggerComment) {
      await prisma.comment.create({
        data: {
          body: output.trim(),
          taskId: triggerComment.taskId,
          projectId: triggerComment.projectId,
          agentRunId: triggerComment.agentRunId,
          userId: null,
          agentId: run.agentConfigId ?? run.model,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
