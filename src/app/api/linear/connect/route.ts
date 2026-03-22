import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateLinearKey } from "@/lib/linear-client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { apiKey } = await req.json()
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key required" }, { status: 400 })
  }

  const result = await validateLinearKey(apiKey)
  if (!result.valid) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 })
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.email },
    update: { linearApiKey: apiKey },
    create: { userId: session.user.email, linearApiKey: apiKey },
  })

  return NextResponse.json({ connected: true, workspace: result.workspace, email: result.email })
}
