import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json({ error: "Bridge not configured" }, { status: 400 })
  }

  try {
    const base = settings.bridgeUrl.replace(/\/+$/, "")
    const res = await fetch(`${base}/api/logs?limit=200`, {
      headers: { "x-api-key": settings.bridgeApiKey || "" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Bridge returned ${res.status}` }, { status: 502 })
    }

    const logs = await res.json()
    return NextResponse.json(logs)
  } catch {
    return NextResponse.json({ error: "Failed to reach bridge" }, { status: 502 })
  }
}
