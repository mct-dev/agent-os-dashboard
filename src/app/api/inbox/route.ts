import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

async function authenticate(req: NextRequest): Promise<boolean> {
  // Check API key first (external clients like bridge)
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

  const items = await prisma.inboxItem.findMany({
    orderBy: { createdAt: "desc" },
  })

  const serialized = items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    snoozedUntil: item.snoozedUntil?.toISOString() ?? null,
    repliedAt: item.repliedAt?.toISOString() ?? null,
  }))

  return NextResponse.json(serialized)
}

export async function POST(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  if (!body.agentName?.trim()) {
    return NextResponse.json(
      { error: "agentName is required" },
      { status: 400 }
    )
  }

  if (!body.question?.trim()) {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 }
    )
  }

  const item = await prisma.inboxItem.create({
    data: {
      agentRunId: body.agentRunId ?? null,
      taskId: body.taskId ?? null,
      agentName: body.agentName,
      taskTitle: body.taskTitle ?? "",
      question: body.question,
      priority: body.priority ?? "MEDIUM",
    },
  })

  const serialized = {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    snoozedUntil: item.snoozedUntil?.toISOString() ?? null,
    repliedAt: item.repliedAt?.toISOString() ?? null,
  }

  return NextResponse.json(serialized, { status: 201 })
}
