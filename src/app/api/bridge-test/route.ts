import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bridgeUrl, bridgeApiKey } = await req.json()

  if (!bridgeUrl) {
    return NextResponse.json({ ok: false, error: "Bridge URL is required" })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

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
    let message = "Unknown error"
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        message = "Connection timed out (30s)"
      } else {
        // Node undici wraps the real error in .cause
        const cause = (err as Error & { cause?: Error }).cause
        message = cause?.message ?? err.message
        // "fetch failed" alone is useless - surface the underlying reason
        if (err.message === "fetch failed" && cause) {
          const code = (cause as NodeJS.ErrnoException).code
          if (code === "ENOTFOUND") {
            message = `DNS lookup failed for host`
          } else if (code === "ECONNREFUSED") {
            message = `Connection refused by bridge`
          } else if (code === "ERR_SSL_WRONG_VERSION_NUMBER" || cause.message?.includes("SSL")) {
            message = `TLS/SSL error — is the bridge URL using the correct protocol?`
          } else if (code) {
            message = `${cause.message} (${code})`
          }
        }
      }
    }
    return NextResponse.json({ ok: false, error: message })
  }
}
