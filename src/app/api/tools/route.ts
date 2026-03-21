import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const FALLBACK_TOOLS = [
  { id: "claude-code", name: "Claude Code", icon: "🟣", adapter: "claude" },
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json(FALLBACK_TOOLS)
  }

  const settings = await prisma.userSettings.findFirst({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json(FALLBACK_TOOLS)
  }

  try {
    const url = settings.bridgeUrl.replace(/\/+$/, "") + "/api/tools"
    const res = await fetch(url, {
      headers: { "x-api-key": settings.bridgeApiKey ?? "" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return NextResponse.json(FALLBACK_TOOLS)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json(FALLBACK_TOOLS)
  }
}
