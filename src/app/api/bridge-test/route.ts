import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { bridgeUrl, bridgeApiKey } = await req.json()

  if (!bridgeUrl) {
    return NextResponse.json({ ok: false, error: "Bridge URL is required" })
  }

  try {
    const base = bridgeUrl.replace(/\/+$/, "")
    const headers = { "x-api-key": bridgeApiKey || "" }

    // Hit an authenticated endpoint to validate both connectivity and API key
    const toolsRes = await fetch(base + "/api/tools", {
      headers,
      signal: AbortSignal.timeout(30000),
    })

    if (!toolsRes.ok) {
      const hint = toolsRes.status === 401 ? " (check API key)" : ""
      return NextResponse.json({
        ok: false,
        error: `HTTP ${toolsRes.status}: ${toolsRes.statusText}${hint}`,
      })
    }

    // Fetch version + scheduler status from health endpoint
    let version = "unknown"
    let schedulerEnabled = false
    try {
      const healthRes = await fetch(base + "/api/health", {
        signal: AbortSignal.timeout(5000),
      })
      if (healthRes.ok) {
        const health = await healthRes.json()
        version = health.version ?? "unknown"
        schedulerEnabled = health.schedulerEnabled ?? false
      }
    } catch { /* health details are optional */ }

    return NextResponse.json({ ok: true, version, schedulerEnabled })
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
