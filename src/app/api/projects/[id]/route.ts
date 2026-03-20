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
  if (body.color !== undefined) data.color = body.color
  if (body.emoji !== undefined) data.emoji = body.emoji
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

  const project = await prisma.project.update({
    where: { id },
    data,
  })

  return NextResponse.json(project)
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

  await prisma.project.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
