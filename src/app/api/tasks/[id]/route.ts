import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate, serializeTask } from "@/lib/api-helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const task = await prisma.task.findUnique({
    where: { id },
    include: { runs: { orderBy: { startedAt: "desc" } } },
  })

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  return NextResponse.json(serializeTask(task))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  // Build update data from allowed fields
  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = String(body.title)
  if (body.description !== undefined) data.description = body.description
  if (body.status !== undefined) data.status = String(body.status).toUpperCase()
  if (body.priority !== undefined) data.priority = String(body.priority).toUpperCase()
  if (body.projectId !== undefined) data.projectId = body.projectId
  if (body.sopId !== undefined) data.sopId = body.sopId

  const task = await prisma.task.update({
    where: { id },
    data,
    include: { runs: { orderBy: { startedAt: "desc" } } },
  })

  return NextResponse.json(serializeTask(task))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Cascade delete is configured in Prisma schema (onDelete: Cascade on AgentRun.task)
  await prisma.task.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
