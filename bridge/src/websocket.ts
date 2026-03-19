import { WebSocketServer, WebSocket } from "ws"
import type { LogEntry } from "./log-store.js"

let wss: WebSocketServer

const clients = new Map<WebSocket, { runId?: string }>()

export function initWebSocket(server: any) {
  wss = new WebSocketServer({ server, path: "/api/events/ws" })

  wss.on("connection", (ws) => {
    clients.set(ws, {})

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === "subscribe" && msg.runId) {
          clients.set(ws, { runId: msg.runId })
        }
      } catch {}
    })

    ws.on("close", () => clients.delete(ws))
    ws.on("error", () => clients.delete(ws))
  })
}

export function broadcastChunk(runId: string, entry: LogEntry) {
  const payload = JSON.stringify({ type: "run.log", runId, ...entry })
  for (const [ws, meta] of clients) {
    if (ws.readyState === WebSocket.OPEN && (!meta.runId || meta.runId === runId)) {
      ws.send(payload)
    }
  }
}
