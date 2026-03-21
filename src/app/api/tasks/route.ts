import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate, serializeTask } from "@/lib/api-helpers"

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const project = req.nextUrl.searchParams.get("project")

  const tasks = await prisma.task.findMany({
    where: project ? { projectId: project } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { runs: { orderBy: { startedAt: "desc" } } },
  })

  return NextResponse.json(tasks.map(serializeTask))
}

export async function POST(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      projectId: body.projectId ?? null,
      priority: body.priority ?? "MEDIUM",
      sopId: body.sopId,
    },
    include: { runs: true },
  })

  return NextResponse.json(serializeTask(task), { status: 201 })
}
