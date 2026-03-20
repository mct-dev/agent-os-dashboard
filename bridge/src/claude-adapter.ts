import { runChildProcess } from "./process-runner.js"
import { getDb } from "./db.js"
import { appendLog } from "./log-store.js"
import { broadcastChunk, broadcastStatus } from "./websocket.js"

export async function spawnClaudeRun(run: {
  id: string
  task_id: string
  task_title: string
  task_description?: string
  prompt: string
  model?: string
  cwd?: string
}) {
  const db = getDb()

  // Look up existing session for this task
  const sessionRow = db.prepare(
    "SELECT session_id FROM task_sessions WHERE task_id = ? AND adapter = 'claude'"
  ).get(run.task_id) as { session_id: string } | undefined
  const sessionId = sessionRow?.session_id

  const args = [
    "--print", "-",
    "--output-format", "stream-json",
    "--verbose",
    "--dangerously-skip-permissions",
  ]

  if (sessionId) {
    args.push("--resume", sessionId)
  }

  if (run.model) {
    args.push("--model", run.model)
  }

  // Mark as running
  db.prepare("UPDATE runs SET status = 'running', started_at = ? WHERE id = ?").run(
    Date.now(),
    run.id
  )

  try {
    const result = await runChildProcess(run.id, "claude", args, {
      cwd: run.cwd ?? process.env.HOME ?? "/tmp",
      env: {} as any, // nesting vars are stripped inside runChildProcess
      timeoutSec: 3600, // 1 hour max
      graceSec: 10,
      stdin: run.prompt,
      onLog: async (stream, chunk) => {
        const entry = { ts: Date.now(), stream, chunk }
        appendLog(run.id, entry)
        broadcastChunk(run.id, entry)

        // Extract sessionId from Claude stream-json output
        try {
          const lines = chunk.split("\n").filter(Boolean)
          for (const line of lines) {
            const parsed = JSON.parse(line)
            if (parsed.type === "system" && parsed.session_id) {
              db.prepare(
                "INSERT OR REPLACE INTO task_sessions (task_id, adapter, session_id, updated_at) VALUES (?, 'claude', ?, ?)"
              ).run(run.task_id, parsed.session_id, Date.now())
              // Also store on the run itself
              db.prepare("UPDATE runs SET session_id = ? WHERE id = ?").run(
                parsed.session_id,
                run.id
              )
            }
          }
        } catch {}
      },
    })

    const newStatus = result.timedOut
      ? "failed"
      : result.exitCode === 0
        ? "completed"
        : "failed"
    db.prepare(
      "UPDATE runs SET status = ?, exit_code = ?, ended_at = ? WHERE id = ?"
    ).run(newStatus, result.exitCode, Date.now(), run.id)
    broadcastStatus(run.id, newStatus)
  } catch (err) {
    db.prepare("UPDATE runs SET status = 'failed', ended_at = ? WHERE id = ?").run(
      Date.now(),
      run.id
    )
    broadcastStatus(run.id, "failed")
    throw err
  }
}
