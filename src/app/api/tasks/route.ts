import { NextRequest, NextResponse } from "next/server"
import type { Project } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { serializeTask, parseProjectId } from "@/lib/api-helpers"

async function authenticate(req: NextRequest): Promise<boolean> {
  // Check API key first (external clients like Telegram)
  const apiKey = req.headers.get("x-api-key")
  if (apiKey && apiKey === process.env.ICARUS_API_KEY) {
    return true
  }
  // Fall back to NextAuth session (dashboard)
  const session = await getSession()
  if (session?.user?.email) {
    return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const project = req.nextUrl.searchParams.get("project")

  const tasks = await prisma.task.findMany({
    where: project ? { project: project.toUpperCase() as Project } : undefined,
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

  // Accept either projectId (frontend) or project (legacy API)
  const project = body.projectId
    ? parseProjectId(body.projectId)
    : body.project ?? "PERSONAL"

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      project: project as Project,
      priority: body.priority ?? "MEDIUM",
      sopId: body.sopId,
    },
    include: { runs: true },
  })

  return NextResponse.json(serializeTask(task), { status: 201 })
}
