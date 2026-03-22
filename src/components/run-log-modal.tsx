"use client"

import { useState, useEffect, useRef } from "react"
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

export function RunLogModal({ runId, runMeta, onClose }: RunLogModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    setError(null)
    setLogs([])

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
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
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
          <div className="flex items-center gap-4 text-[11px] text-base-content/50">
            {runMeta?.startedAt && (
              <span>{new Date(runMeta.startedAt).toLocaleString()}</span>
            )}
            {runMeta?.costUsd != null && (
              <span className="text-emerald-400/70">${runMeta.costUsd.toFixed(2)}</span>
            )}
            {runMeta?.tokenCount != null && (
              <span>{runMeta.tokenCount.toLocaleString()} tokens</span>
            )}
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-base-300/30 mx-4 mb-4 rounded-lg p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
        >
          {loading && (
            <span className="text-base-content/50 animate-pulse">Loading logs...</span>
          )}
          {error && (
            <span className="text-error">Failed to load logs: {error}</span>
          )}
          {!loading && !error && logs.length === 0 && (
            <span className="text-base-content/40">No logs available for this run. Logs are only stored on the bridge machine where the run executed.</span>
          )}
          {logs.map((entry, i) => (
            <span
              key={i}
              className={entry.stream === "stderr" ? "text-error/70" : "text-base-content/80"}
            >
              {entry.chunk}
            </span>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
