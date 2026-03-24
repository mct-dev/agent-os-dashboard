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
  system_prompt?: string
  callback_url?: string
  callback_api_key?: string
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
    // Strip provider prefix (e.g., "anthropic/claude-opus-4-6" → "claude-opus-4-6")
    const modelId = run.model.includes("/") ? run.model.split("/").pop()! : run.model
    args.push("--model", modelId)
  }

  if (run.system_prompt) {
    args.push("--system-prompt", run.system_prompt)
  }

  // Mark as running
  db.prepare("UPDATE runs SET status = 'running', started_at = ? WHERE id = ?").run(
    Date.now(),
    run.id
  )

  // Accumulate stdout output during the run for callback
  let finalOutput = ""

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

        // Accumulate stdout for the callback
        if (stream === "stdout") finalOutput += chunk

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

    // Call completion callback if provided
    if (run.callback_url) {
      try {
        await fetch(run.callback_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bridgeRunId: run.id,
            status: newStatus,
            output: finalOutput || null,
            api_key: run.callback_api_key ?? "",
          }),
        })
      } catch (err) {
        console.error(`Callback failed for run ${run.id}:`, err)
      }
    }
  } catch (err) {
    db.prepare("UPDATE runs SET status = 'failed', ended_at = ? WHERE id = ?").run(
      Date.now(),
      run.id
    )
    broadcastStatus(run.id, "failed")

    // Call completion callback on failure too
    if (run.callback_url) {
      try {
        await fetch(run.callback_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bridgeRunId: run.id,
            status: "failed",
            output: finalOutput || null,
            api_key: run.callback_api_key ?? "",
          }),
        })
      } catch (callbackErr) {
        console.error(`Callback failed for run ${run.id}:`, callbackErr)
      }
    }

    throw err
  }
}
