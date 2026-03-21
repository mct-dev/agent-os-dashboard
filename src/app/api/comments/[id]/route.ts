import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { serializeComment } from "@/lib/api-helpers"
import { auth } from "@/lib/auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  if (!body.body?.trim()) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    )
  }

  const comment = await prisma.comment.findUnique({ where: { id } })
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }

  if (comment.userId !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { body: body.body },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  return NextResponse.json(serializeComment(updated))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const comment = await prisma.comment.findUnique({ where: { id } })
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }

  if (comment.userId !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.comment.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
