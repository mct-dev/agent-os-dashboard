import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const FALLBACK_MODELS: Record<string, { id: string; name: string }[]> = {
  "claude-code": [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ],
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ toolId: string }> }
) {
  const { toolId } = await params
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json(FALLBACK_MODELS[toolId] ?? [])
  }

  const settings = await prisma.userSettings.findFirst({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json(FALLBACK_MODELS[toolId] ?? [])
  }

  try {
    const url =
      settings.bridgeUrl.replace(/\/+$/, "") +
      `/api/tools/${encodeURIComponent(toolId)}/models`
    const res = await fetch(url, {
      headers: { "x-api-key": settings.bridgeApiKey ?? "" },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return NextResponse.json(FALLBACK_MODELS[toolId] ?? [])
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json(FALLBACK_MODELS[toolId] ?? [])
  }
}
