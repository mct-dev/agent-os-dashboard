import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (apiKey !== process.env.ICARUS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json()
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      project: body.project ?? "PERSONAL",
      priority: body.priority ?? "MEDIUM",
      sopId: body.sopId,
    }
  })
  return NextResponse.json(task, { status: 201 })
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")
  if (apiKey !== process.env.ICARUS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const project = searchParams.get("project")
  const tasks = await prisma.task.findMany({
    where: project ? { project: project as any } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } }
  })
  return NextResponse.json(tasks)
}
