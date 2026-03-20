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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const sop = await prisma.sop.findUnique({
    where: { id },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  })

  if (!sop) {
    return NextResponse.json({ error: "SOP not found" }, { status: 404 })
  }

  return NextResponse.json(sop)
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

  const sop = await prisma.$transaction(async (tx) => {
    if (body.stages) {
      await tx.sopStage.deleteMany({ where: { sopId: id } })
    }
    const updated = await tx.sop.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.stages && {
          stages: {
            create: body.stages.map(
              (
                s: { name: string; role: string; prompt: string },
                i: number
              ) => ({
                name: s.name,
                role: s.role,
                prompt: s.prompt,
                sortOrder: i,
              })
            ),
          },
        }),
      },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    })
    return updated
  })

  return NextResponse.json(sop)
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

  await prisma.sop.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
