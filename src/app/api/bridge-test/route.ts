import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

async function getAuthOptions() {
  const GoogleProvider = (await import("next-auth/providers/google")).default
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    callbacks: {
      async signIn({ profile }: { profile?: { email?: string } }) {
        return profile?.email === "mike@laurel.ai" || profile?.email === "axis139@gmail.com"
      },
    },
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bridgeUrl, bridgeApiKey } = await req.json()

  if (!bridgeUrl) {
    return NextResponse.json({ ok: false, error: "Bridge URL is required" })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const url = bridgeUrl.replace(/\/+$/, "") + "/api/health"
    const res = await fetch(url, {
      headers: {
        "x-api-key": bridgeApiKey || "",
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `HTTP ${res.status}: ${res.statusText}`,
      })
    }

    const data = await res.json()
    return NextResponse.json({
      ok: true,
      version: data.version ?? "unknown",
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Connection timed out (5s)"
          : err.message
        : "Unknown error"
    return NextResponse.json({ ok: false, error: message })
  }
}
