import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const FALLBACK_MODELS = [
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
]

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json(FALLBACK_MODELS)
  }

  // Fetch bridge URL from user settings
  const settings = await prisma.userSettings.findFirst({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json(FALLBACK_MODELS)
  }

  try {
    const url = settings.bridgeUrl.replace(/\/+$/, "") + "/api/models"
    const res = await fetch(url, {
      headers: {
        "x-api-key": settings.bridgeApiKey ?? "",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json(FALLBACK_MODELS)
    }

    const models = await res.json()
    return NextResponse.json(models)
  } catch {
    return NextResponse.json(FALLBACK_MODELS)
  }
}
