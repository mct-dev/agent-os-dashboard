"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppState } from "@/lib/store"
import { CommentThread } from "@/components/comment-thread"
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUSES, LLM_MODELS, type AgentRun } from "@/lib/types"
import { updateTask as apiUpdateTask, startRun, stopRun } from "@/lib/api-client"
import { LinearLinkSection } from "@/components/linear-link-section"
import { RunLogModal } from "@/components/run-log-modal"
import { toast } from "sonner"

const TERMINAL_STATUSES = new Set(["completed", "failed", "stopped"])

function RunStreamOutput({ runId, onStatusChange }: { runId: string; onStatusChange: (status: string) => void }) {
  const [chunks, setChunks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/stream`)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "log" && data.chunk) {
          setChunks((prev) => [...prev, data.chunk])
        } else if (data.type === "status" && TERMINAL_STATUSES.has(data.status)) {
          onStatusChange(data.status.toUpperCase())
          es.close()
        } else if (data.type === "error") {
          setError(data.message ?? "Stream error")
          es.close()
        }
      } catch {
        // Ignore parse errors from non-JSON messages
      }
    }

    es.onerror = () => {
      setError("Connection lost")
      es.close()
    }

    return () => {
      es.close()
    }
  }, [runId, onStatusChange])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chunks])

  return (
    <div
      ref={scrollRef}
      className="bg-background rounded p-2 max-h-48 overflow-y-auto border border-border font-mono text-[11px] text-muted-foreground whitespace-pre-wrap"
    >
      {error ? (
        <span className="text-red-400">{error}</span>
      ) : chunks.length === 0 ? (
        <span className="animate-pulse">Connecting...</span>
      ) : (
        chunks.join("")
      )}
    </div>
  )
}

export function TaskPanel() {
  const { selectedTaskId, setSelectedTaskId, tasks, setTasks, projects, sops } = useAppState()
  const task = tasks.find((t) => t.id === selectedTaskId)

  const [runModel, setRunModel] = useState<string>(LLM_MODELS[0])
  const [runPrompt, setRunPrompt] = useState("")
  const [isStartingRun, setIsStartingRun] = useState(false)
  const [viewingRun, setViewingRun] = useState<AgentRun | null>(null)

  // Update prompt when task changes
  useEffect(() => {
    if (task) {
      const parts = [task.title]
      if (task.description) parts.push(task.description)
      setRunPrompt(parts.join("\n\n"))
    }
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTaskLocal = useCallback((updates: Partial<typeof task>) => {
    if (!task) return
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t))
    )
  }, [task, setTasks])

  const persistField = useCallback((field: string, value: string | null) => {
    if (!task) return
    apiUpdateTask(task.id, { [field]: value }).catch(() => {
      toast.error(`Failed to update ${field}`)
    })
  }, [task])

  const handleSelectChange = useCallback((field: string, value: string | null) => {
    updateTaskLocal({ [field]: value })
    persistField(field, value)
  }, [updateTaskLocal, persistField])

  const handleTitleBlur = useCallback((value: string) => {
    persistField("title", value)
  }, [persistField])

  const handleDescriptionBlur = useCallback((value: string) => {
    persistField("description", value || null)
  }, [persistField])

  const handleStartRun = async () => {
    if (!task || !runPrompt.trim()) return
    setIsStartingRun(true)
    try {
      const result = await startRun({
        taskId: task.id,
        model: runModel,
        prompt: runPrompt.trim(),
      })
      // Add the new run optimistically
      const newRun: AgentRun = {
        id: result.id,
        status: "RUNNING",
        model: runModel,
        costUsd: null,
        tokenCount: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        bridgeRunId: result.bridgeRunId,
        prompt: runPrompt.trim(),
        output: null,
        triggerCommentId: null,
        agentConfigId: null,
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, runs: [...t.runs, newRun] } : t
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start run")
    } finally {
      setIsStartingRun(false)
    }
  }

  const handleStopRun = async (run: AgentRun) => {
    if (!task) return
    // Optimistic: show STOPPED
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              runs: t.runs.map((r) =>
                r.id === run.id ? { ...r, status: "STOPPED" as const } : r
              ),
            }
          : t
      )
    )
    try {
      await stopRun(run.id)
    } catch {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                runs: t.runs.map((r) =>
                  r.id === run.id ? { ...r, status: "RUNNING" as const } : r
                ),
              }
            : t
        )
      )
      toast.error("Failed to stop run")
    }
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) setSelectedTaskId(null) }}>
      <DialogContent className="w-[75vw] max-w-none sm:max-w-none max-h-[90vh] overflow-y-auto p-0">
        {task && (
          <div className="flex flex-col">
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-base-content/60">AGT-{task.id}</span>
                <span className="text-base-content/60">→</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-5 ${PRIORITY_CONFIG[task.priority].color}`}
                >
                  {PRIORITY_CONFIG[task.priority].icon} {task.priority}
                </Badge>
              </div>
              <DialogTitle className="sr-only">Task Details</DialogTitle>
            </DialogHeader>

            <div className="px-6 pb-6 space-y-0">
              {/* Run Dispatch */}
              <div className="py-4 space-y-3">
                <Select value={runModel} onValueChange={setRunModel}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={runPrompt}
                  onChange={(e) => setRunPrompt(e.target.value)}
                  placeholder="Prompt for the agent..."
                  className="text-sm min-h-[120px] resize-y font-mono rounded-md"
                  rows={5}
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStartRun}
                  disabled={isStartingRun || !runPrompt.trim()}
                >
                  {isStartingRun ? "Starting..." : "Start Run"}
                </Button>
              </div>

              <Separator />

              {/* Title */}
              <div className="py-4">
                <Input
                  value={task.title}
                  onChange={(e) => updateTaskLocal({ title: e.target.value })}
                  onBlur={(e) => handleTitleBlur(e.target.value)}
                  className="text-xl font-semibold bg-transparent border-none px-0 h-auto focus-visible:ring-0 focus-visible:border-b focus-visible:border-base-300 focus-visible:rounded-none"
                />
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-[120px_1fr] items-center gap-y-3 py-4">
                <span className="text-xs text-base-content/60 font-medium uppercase tracking-wide">Status</span>
                <Select
                  value={task.status}
                  onValueChange={(v) => handleSelectChange("status", v)}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dotColor}`} />
                          {STATUS_CONFIG[s].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-xs text-base-content/60 font-medium uppercase tracking-wide">Priority</span>
                <Select
                  value={task.priority}
                  onValueChange={(v) => handleSelectChange("priority", v)}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className={PRIORITY_CONFIG[p].color}>
                          {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-xs text-base-content/60 font-medium uppercase tracking-wide">Project</span>
                <Select
                  value={task.projectId}
                  onValueChange={(v) => handleSelectChange("projectId", v)}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.emoji} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-xs text-base-content/60 font-medium uppercase tracking-wide">SOP</span>
                <Select
                  value={task.sopId ?? "none"}
                  onValueChange={(v) => handleSelectChange("sopId", v === "none" ? null : v)}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Linked Linear Issues */}
              <div className="px-4 py-2">
                <LinearLinkSection task={task} />
              </div>

              <Separator />

              {/* Description */}
              <div className="py-4">
                <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-2 block">
                  Description
                </label>
                <Textarea
                  value={task.description ?? ""}
                  onChange={(e) => updateTaskLocal({ description: e.target.value || null })}
                  onBlur={(e) => handleDescriptionBlur(e.target.value)}
                  placeholder="Add a description..."
                  className="text-sm min-h-[140px] resize-y rounded-md"
                  rows={6}
                />
              </div>

              <Separator />

              {/* Run History */}
              <div className="py-4">
                <h3 className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-3">
                  Run History
                </h3>
                {task.runs.length === 0 ? (
                  <p className="text-sm text-base-content/60">No runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {task.runs.map((run) => (
                      <div
                        key={run.id}
                        className="bg-base-200 rounded-md p-3 border border-base-300 cursor-pointer hover:border-base-content/20 transition-colors"
                        onClick={() => setViewingRun(run)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-base-content/60">{run.model}</span>
                          <Badge
                            variant={
                              run.status === "COMPLETED" ? "secondary" :
                              run.status === "FAILED" ? "destructive" :
                              "outline"
                            }
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {run.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-base-content/60">
                          {run.costUsd !== null && (
                            <span className="text-emerald-400/70">${run.costUsd.toFixed(2)}</span>
                          )}
                          {run.tokenCount !== null && (
                            <span>{run.tokenCount.toLocaleString()} tokens</span>
                          )}
                          <span>{new Date(run.startedAt).toLocaleString()}</span>
                        </div>
                        {run.status === "RUNNING" && (
                          <div className="mt-2">
                            <RunStreamOutput
                              runId={run.id}
                              onStatusChange={(newStatus) => {
                                setTasks((prev) =>
                                  prev.map((t) =>
                                    t.id === task.id
                                      ? {
                                          ...t,
                                          runs: t.runs.map((r) =>
                                            r.id === run.id
                                              ? { ...r, status: newStatus as AgentRun["status"], endedAt: new Date().toISOString() }
                                              : r
                                          ),
                                        }
                                      : t
                                  )
                                )
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 h-6 text-[11px] text-error"
                              onClick={() => handleStopRun(run)}
                            >
                              Stop
                            </Button>
                          </div>
                        )}
                        {TERMINAL_STATUSES.has(run.status.toLowerCase()) && (
                          <details className="mt-2">
                            <summary className="text-[10px] text-base-content/40 cursor-pointer hover:text-base-content/60">
                              Comments
                            </summary>
                            <div className="mt-2">
                              <CommentThread agentRunId={run.id} />
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="px-4 pb-6">
                <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
                  Comments
                </h3>
                <CommentThread taskId={task.id} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <RunLogModal
        runId={viewingRun?.id ?? null}
        runMeta={viewingRun ? {
          model: viewingRun.model,
          status: viewingRun.status,
          startedAt: viewingRun.startedAt,
          costUsd: viewingRun.costUsd,
          tokenCount: viewingRun.tokenCount,
        } : undefined}
        onClose={() => setViewingRun(null)}
      />
    </Dialog>
  )
}
