"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface RunLogModalProps {
  runId: string | null
  runMeta?: {
    model?: string
    status?: string
    startedAt?: string
    costUsd?: number | null
    tokenCount?: number | null
  }
  onClose: () => void
}

interface LogEntry {
  ts: number
  stream: "stdout" | "stderr"
  chunk: string
}

// Parsed message for chat display
interface ChatMessage {
  role: "user" | "assistant" | "tool" | "system" | "error"
  content: string
  toolName?: string
  toolId?: string
  costUsd?: number
  model?: string
  sessionId?: string
}

function parseLogsToChat(logs: LogEntry[]): ChatMessage[] {
  const messages: ChatMessage[] = []

  // Concatenate all stdout into one string and split into JSON lines
  const fullStdout = logs
    .filter((l) => l.stream === "stdout")
    .map((l) => l.chunk)
    .join("")

  const fullStderr = logs
    .filter((l) => l.stream === "stderr")
    .map((l) => l.chunk)
    .join("")
    .trim()

  if (fullStderr) {
    messages.push({ role: "error", content: fullStderr })
  }

  const lines = fullStdout.split("\n").filter(Boolean)

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)

      if (parsed.type === "user" && parsed.message) {
        // User message
        const text = parsed.message?.content
          ?.filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("\n") ?? ""
        if (text) {
          messages.push({ role: "user", content: text })
        }
      } else if (parsed.type === "assistant" && parsed.message) {
        // Assistant message — extract text blocks and tool calls
        const content = parsed.message.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              messages.push({
                role: "assistant",
                content: block.text,
                model: parsed.message.model,
              })
            } else if (block.type === "tool_use") {
              const input = typeof block.input === "string"
                ? block.input
                : JSON.stringify(block.input, null, 2)
              messages.push({
                role: "tool",
                toolName: block.name,
                toolId: block.id,
                content: input.length > 500 ? input.slice(0, 500) + "\n..." : input,
              })
            }
          }
        }
      } else if (parsed.type === "tool_use_result" || parsed.type === "tool_result") {
        // Tool result
        const stdout = parsed.tool_use_result?.stdout ?? parsed.stdout ?? ""
        const stderr = parsed.tool_use_result?.stderr ?? parsed.stderr ?? ""
        const combined = [stdout, stderr].filter(Boolean).join("\n")
        if (combined) {
          messages.push({
            role: "tool",
            toolName: "result",
            content: combined.length > 2000 ? combined.slice(0, 2000) + "\n... (truncated)" : combined,
          })
        }
      } else if (parsed.type === "result") {
        // Final result
        const text = parsed.result ?? parsed.text ?? ""
        if (text && !parsed.is_error) {
          messages.push({ role: "assistant", content: text, costUsd: parsed.total_cost_usd })
        } else if (parsed.is_error) {
          messages.push({ role: "error", content: text || "Run failed" })
        }
        if (parsed.total_cost_usd) {
          messages.push({
            role: "system",
            content: `Cost: $${parsed.total_cost_usd.toFixed(4)}`,
            costUsd: parsed.total_cost_usd,
            sessionId: parsed.session_id,
          })
        }
      } else if (parsed.type === "system" && parsed.session_id) {
        // System init — skip, not useful for chat display
      }
    } catch {
      // Not JSON, skip
    }
  }

  return messages
}

export function RunLogModal({ runId, runMeta, onClose }: RunLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    setError(null)
    setLogs([])
    setShowRaw(false)

    fetch(`/api/runs/${runId}/log`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: LogEntry[]) => {
        setLogs(data)
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [runId])

  const chatMessages = useMemo(() => parseLogsToChat(logs), [logs])

  const statusVariant = runMeta?.status === "COMPLETED"
    ? "default"
    : runMeta?.status === "FAILED"
    ? "destructive"
    : runMeta?.status === "RUNNING"
    ? "secondary"
    : "outline"

  return (
    <Dialog open={!!runId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3 text-sm">
              <span>Run Logs</span>
              {runMeta?.status && (
                <Badge variant={statusVariant} className="text-[10px]">
                  {runMeta.status}
                </Badge>
              )}
              {runMeta?.model && (
                <span className="text-xs text-base-content/50 font-normal">{runMeta.model}</span>
              )}
            </DialogTitle>
            <button
              className="text-[11px] text-base-content/40 hover:text-base-content/70 transition-colors"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? "Chat view" : "Raw JSON"}
            </button>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-base-content/50">
            {runMeta?.startedAt && (
              <span>{new Date(runMeta.startedAt).toLocaleString()}</span>
            )}
            {runMeta?.costUsd != null && (
              <span className="text-emerald-400/70">${runMeta.costUsd.toFixed(4)}</span>
            )}
            {runMeta?.tokenCount != null && (
              <span>{runMeta.tokenCount.toLocaleString()} tokens</span>
            )}
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto mx-6 mb-4 rounded-lg"
        >
          {loading && (
            <div className="flex items-center justify-center h-32">
              <span className="text-base-content/50 animate-pulse">Loading logs...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-32">
              <span className="text-error">Failed to load logs: {error}</span>
            </div>
          )}
          {!loading && !error && logs.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <span className="text-base-content/40">No logs available for this run. Logs are only stored on the bridge machine where the run executed.</span>
            </div>
          )}

          {!loading && !error && logs.length > 0 && showRaw && (
            <div className="bg-base-300/30 rounded-lg p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {logs.map((entry, i) => (
                <span
                  key={i}
                  className={entry.stream === "stderr" ? "text-error/70" : "text-base-content/80"}
                >
                  {entry.chunk}
                </span>
              ))}
            </div>
          )}

          {!loading && !error && logs.length > 0 && !showRaw && (
            <div className="space-y-4 max-w-4xl mx-auto py-4">
              {chatMessages.map((msg, i) => {
                if (msg.role === "user") {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="bg-primary/15 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%]">
                        <p className="text-[10px] font-medium text-primary/60 mb-1">You</p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )
                }

                if (msg.role === "assistant") {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="bg-base-200 border border-base-300 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%]">
                        <p className="text-[10px] font-medium text-base-content/40 mb-1">Assistant</p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )
                }

                if (msg.role === "tool" && msg.toolName === "result") {
                  return (
                    <div key={i} className="flex justify-start px-4">
                      <div className="w-full max-w-[75%] bg-base-300/30 border border-base-300/50 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-medium text-base-content/30 mb-1">Tool Result</p>
                        <pre className="text-[11px] text-base-content/60 whitespace-pre-wrap overflow-x-auto font-mono">{msg.content}</pre>
                      </div>
                    </div>
                  )
                }

                if (msg.role === "tool") {
                  return (
                    <div key={i} className="flex justify-start px-4">
                      <div className="w-full max-w-[75%] bg-base-300/20 border border-base-300/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-medium text-amber-400/60 mb-1">
                          Tool: {msg.toolName}
                        </p>
                        <pre className="text-[11px] text-base-content/50 whitespace-pre-wrap overflow-x-auto font-mono">{msg.content}</pre>
                      </div>
                    </div>
                  )
                }

                if (msg.role === "system") {
                  return (
                    <div key={i} className="flex justify-center">
                      <span className="text-[10px] text-base-content/30 bg-base-300/20 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  )
                }

                if (msg.role === "error") {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="bg-error/10 border border-error/20 rounded-lg px-4 py-3 max-w-[75%]">
                        <p className="text-[10px] font-medium text-error/60 mb-1">Error</p>
                        <p className="text-sm text-error/80 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  )
                }

                return null
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
