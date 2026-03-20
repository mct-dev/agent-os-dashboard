import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

async function requireSession() {
  const session = await getSession()
  if (!session?.user?.email) {
    return null
  }
  return session
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.model !== undefined) data.model = body.model
  if (body.description !== undefined) data.description = body.description
  if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt
  if (body.defaultSopId !== undefined) data.defaultSopId = body.defaultSopId

  const agent = await prisma.agentConfig.update({
    where: { id },
    data,
    include: { defaultSop: true },
  })

  return NextResponse.json(agent)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  await prisma.agentConfig.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
