import { homedir } from "os"
import { appendFileSync, readFileSync, existsSync } from "fs"
import path from "path"

const DATA_DIR = path.join(homedir(), ".agent-os-bridge", "logs")

export type LogEntry = { ts: number; stream: "stdout" | "stderr"; chunk: string }

export function appendLog(runId: string, entry: LogEntry) {
  const file = path.join(DATA_DIR, `${runId}.ndjson`)
  appendFileSync(file, JSON.stringify(entry) + "\n")
}

export function readLog(runId: string): LogEntry[] {
  const file = path.join(DATA_DIR, `${runId}.ndjson`)
  if (!existsSync(file)) return []
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as LogEntry)
}
