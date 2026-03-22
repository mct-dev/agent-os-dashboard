import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateLinearKey } from "@/lib/linear-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.linearApiKey) {
    return NextResponse.json({ connected: false })
  }

  const result = await validateLinearKey(settings.linearApiKey)
  if (!result.valid) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({ connected: true, workspace: result.workspace, email: result.email })
}
