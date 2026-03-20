import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function requireSession() {
  const session = await auth()
  if (!session?.user?.email) {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const agents = await prisma.agentConfig.findMany({
    include: { defaultSop: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(agents)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const agent = await prisma.agentConfig.create({
    data: {
      name: body.name,
      ...(body.model !== undefined && { model: body.model }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.systemPrompt !== undefined && {
        systemPrompt: body.systemPrompt,
      }),
      ...(body.defaultSopId !== undefined && {
        defaultSopId: body.defaultSopId,
      }),
    },
    include: { defaultSop: true },
  })

  return NextResponse.json(agent, { status: 201 })
}
