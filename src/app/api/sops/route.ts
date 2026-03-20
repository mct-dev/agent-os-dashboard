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

  const sops = await prisma.sop.findMany({
    include: { stages: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(sops)
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

  if (!Array.isArray(body.stages) || body.stages.length === 0) {
    return NextResponse.json(
      { error: "stages array is required" },
      { status: 400 }
    )
  }

  const sop = await prisma.sop.create({
    data: {
      name: body.name,
      ...(body.description !== undefined && { description: body.description }),
      stages: {
        create: body.stages.map(
          (s: { name: string; role: string; prompt: string }, i: number) => ({
            name: s.name,
            role: s.role,
            prompt: s.prompt,
            sortOrder: i,
          })
        ),
      },
    },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  })

  return NextResponse.json(sop, { status: 201 })
}
