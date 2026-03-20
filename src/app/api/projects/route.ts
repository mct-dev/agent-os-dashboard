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

export async function GET() {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projects = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(projects)
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

  const project = await prisma.project.create({
    data: {
      name: body.name,
      ...(body.color !== undefined && { color: body.color }),
      ...(body.emoji !== undefined && { emoji: body.emoji }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  })

  return NextResponse.json(project, { status: 201 })
}
