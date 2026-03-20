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
  if (body.read !== undefined) data.read = body.read
  if (body.snoozedUntil !== undefined)
    data.snoozedUntil = body.snoozedUntil ? new Date(body.snoozedUntil) : null
  if (body.replyText !== undefined) data.replyText = body.replyText
  if (body.repliedAt !== undefined)
    data.repliedAt = body.repliedAt ? new Date(body.repliedAt) : null

  const item = await prisma.inboxItem.update({
    where: { id },
    data,
  })

  const serialized = {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    snoozedUntil: item.snoozedUntil?.toISOString() ?? null,
    repliedAt: item.repliedAt?.toISOString() ?? null,
  }

  return NextResponse.json(serialized)
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

  await prisma.inboxItem.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
