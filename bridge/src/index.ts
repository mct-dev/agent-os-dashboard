import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { randomUUID } from "crypto"
import { initWebSocket } from "./websocket.js"
import { initDb, getDb } from "./db.js"
import { readLog } from "./log-store.js"
import { spawnClaudeRun } from "./claude-adapter.js"
import { runningProcesses } from "./process-runner.js"

const API_KEY = process.env.BRIDGE_API_KEY ?? "change-me"
const PORT = parseInt(process.env.PORT ?? "4242")
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? ""
const CRON_SECRET = process.env.CRON_SECRET ?? ""
const SCHEDULER_INTERVAL_MS = 60_000 // 1 minute

async function main() {
  const db = await initDb()

  const app = express()
  app.use(express.json())

  // Auth middleware
  function auth(req: any, res: any, next: any) {
    const key =
      req.headers["x-api-key"] ??
      req.headers.authorization?.replace("Bearer ", "")
    if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" })
    next()
  }

  // POST /api/runs — create and start a new run
  app.post("/api/runs", auth, async (req, res) => {
    const {
      task_id,
      task_title,
      task_description,
      sop_id,
      prompt,
      model,
      adapter = "claude",
      cwd,
      callback_url,
      callback_api_key,
    } = req.body
    if (!task_id || !prompt)
      return res.status(400).json({ error: "task_id and prompt required" })

    const id = randomUUID()
    db.prepare(
      `INSERT INTO runs (id, task_id, task_title, task_description, sop_id, adapter, model, status, prompt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`
    ).run(
      id,
      task_id,
      task_title ?? "",
      task_description ?? "",
      sop_id ?? "",
      adapter,
      model ?? "",
      prompt,
      Math.floor(Date.now() / 1000)
    )

    res.json({ runId: id, status: "queued" })

    // Spawn async (don't await in handler)
    spawnClaudeRun({
      id,
      task_id,
      task_title: task_title ?? "",
      task_description,
      prompt,
      model,
      cwd,
      callback_url,
      callback_api_key,
    }).catch((err) => {
      console.error(`Run ${id} failed:`, err)
    })
  })

  // GET /api/runs — list runs (optional ?status= filter)
  app.get("/api/runs", auth, (req, res) => {
    const status = req.query.status as string | undefined
    if (status) {
      const runs = db
        .prepare("SELECT * FROM runs WHERE status = ? ORDER BY created_at DESC LIMIT 100")
        .all(status)
      return res.json(runs)
    }
    const runs = db
      .prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT 100")
      .all()
    res.json(runs)
  })

  // GET /api/runs/:id — get run status
  app.get("/api/runs/:id", auth, (req, res) => {
    const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(req.params.id)
    if (!run) return res.status(404).json({ error: "Not found" })
    res.json(run)
  })

  // GET /api/runs/:id/log — get persisted NDJSON log
  app.get("/api/runs/:id/log", auth, (req, res) => {
    const entries = readLog(req.params.id)
    res.json(entries)
  })

  // POST /api/runs/:id/cancel — cancel a running process
  app.post("/api/runs/:id/cancel", auth, (req, res) => {
    const proc = runningProcesses.get(req.params.id)
    if (proc) {
      proc.child.kill("SIGTERM")
      setTimeout(() => {
        if (!proc.child.killed) proc.child.kill("SIGKILL")
      }, proc.graceSec * 1000)
    }
    db.prepare(
      "UPDATE runs SET status = 'stopped', ended_at = ? WHERE id = ?"
    ).run(Date.now(), req.params.id)
    res.json({ ok: true })
  })

  // GET /api/tools — list available tools/adapters
  app.get("/api/tools", auth, (_req, res) => {
    res.json([
      { id: "claude-code", name: "Claude Code", icon: "🟣", adapter: "claude" },
      { id: "codex", name: "Codex (OpenAI)", icon: "🟢", adapter: "codex" },
    ])
  })

  // GET /api/tools/:id/models — list models for a specific tool
  app.get("/api/tools/:id/models", auth, (req, res) => {
    const toolModels: Record<string, { id: string; name: string }[]> = {
      "claude-code": [
        { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
        { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
      ],
      "codex": [
        { id: "o4-mini", name: "o4-mini" },
        { id: "codex-mini-latest", name: "Codex Mini" },
      ],
    }

    const models = toolModels[req.params.id]
    if (!models) return res.status(404).json({ error: "Unknown tool" })
    res.json(models)
  })

  // GET /api/models — list available models (legacy, returns all)
  app.get("/api/models", auth, (_req, res) => {
    res.json([
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "claude-code" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "claude-code" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "claude-code" },
      { id: "o4-mini", name: "o4-mini", provider: "codex" },
      { id: "codex-mini-latest", name: "Codex Mini", provider: "codex" },
    ])
  })

  // GET /api/health
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, version: "1.0.0" })
  )

  // On startup: reap orphaned runs
  db.prepare(
    "UPDATE runs SET status = 'process_lost' WHERE status = 'running'"
  ).run()

  const server = createServer(app)
  initWebSocket(server)

  server.listen(PORT, async () => {
    console.log(`Agent OS Bridge running on port ${PORT}`)
    try {
      const { execSync } = await import("child_process")
      const tsHost = execSync("tailscale status --self --json 2>/dev/null", { encoding: "utf8" })
      const ts = JSON.parse(tsHost)
      const hostname = ts?.Self?.DNSName?.replace(/\.$/, "") ?? null
      if (hostname) {
        console.log(`Tailscale URL: https://${hostname}/api/...`)
      } else {
        console.log(`Tailscale URL: (not available — is Tailscale running?)`)
      }
    } catch {
      console.log(`Tailscale URL: (could not detect — is Tailscale running?)`)
    }

    // Start scheduler polling if dashboard URL is configured
    if (DASHBOARD_URL && CRON_SECRET) {
      const dashboardBase = DASHBOARD_URL.replace(/\/+$/, "")
      console.log(`Scheduler polling enabled → ${dashboardBase}/api/cron/scheduler (every 60s)`)

      const tick = async () => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 30_000)
          const res = await fetch(`${dashboardBase}/api/cron/scheduler`, {
            method: "POST",
            headers: { Authorization: `Bearer ${CRON_SECRET}` },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (res.ok) {
            const data = await res.json() as { processed?: number }
            if (data.processed && data.processed > 0) {
              console.log(`Scheduler tick: ${data.processed} job(s) processed`)
            }
          } else {
            console.error(`Scheduler tick failed: ${res.status}`)
          }
        } catch (err) {
          // Silent on abort/network errors — bridge may be starting up
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("Scheduler tick error:", err.message)
          }
        }
      }

      // Run first tick after a short delay, then every minute
      setTimeout(tick, 5_000)
      setInterval(tick, SCHEDULER_INTERVAL_MS)
    } else {
      console.log("Scheduler polling disabled (set DASHBOARD_URL and CRON_SECRET to enable)")
    }
  })
}

main().catch((err) => {
  console.error("Failed to start:", err)
  process.exit(1)
})
