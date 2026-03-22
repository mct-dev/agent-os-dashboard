"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAppState } from "@/lib/store"
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  fetchScheduleRuns,
} from "@/lib/api-client"
import type { ScheduleRun } from "@/lib/api-client"
import { RunLogModal } from "@/components/run-log-modal"
import { toast } from "sonner"
import { DAY_NAMES, PRESET_LABELS } from "@/lib/schedule-utils"
import type { ScheduledJob, SchedulePreset } from "@/lib/types"

interface ToolOption {
  id: string
  name: string
  icon: string
  adapter: string
}

interface ToolModel {
  id: string
  name: string
}

export interface ScheduleJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editJob?: ScheduledJob | null
  defaultDate?: Date | null
}

const PRESETS: SchedulePreset[] = ["once", "hourly", "daily", "weekly", "monthly"]

/** Convert a local date string + time string to a UTC ISO string */
function localDateTimeToUtc(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}

/** Extract local "HH:MM" from a UTC ISO string */
function utcToLocalTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Extract local "YYYY-MM-DD" from a UTC ISO string */
function utcToLocalDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

/** Convert a local HH:MM time string to UTC hour/minute numbers */
function localTimeToUtcHourMinute(time: string): { hour: number; minute: number } {
  const [localH, localM] = time.split(":").map(Number)
  const ref = new Date()
  ref.setHours(localH, localM, 0, 0)
  return { hour: ref.getUTCHours(), minute: ref.getUTCMinutes() }
}

/** Convert UTC hour/minute back to a local "HH:MM" string */
function utcHourMinuteToLocalTime(hour: number, minute: number): string {
  const ref = new Date()
  ref.setUTCHours(hour, minute, 0, 0)
  const h = String(ref.getHours()).padStart(2, "0")
  const m = String(ref.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Today as "YYYY-MM-DD" in local time */
function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

/** Date object → local "YYYY-MM-DD" */
function dateToLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const da = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

export function ScheduleJobModal({
  open,
  onOpenChange,
  editJob,
  defaultDate,
}: ScheduleJobModalProps) {
  const { agents, tasks, projects, refreshSchedules } = useAppState()

  // ── Core form state ─────────────────────────────────────────────
  const [name, setName] = useState("")
  const [agentId, setAgentId] = useState<string>("none")
  const [tool, setTool] = useState("claude-code")
  const [model, setModel] = useState("")
  const [preset, setPreset] = useState<SchedulePreset>("once")
  const [onceDate, setOnceDate] = useState(todayLocalDate())
  const [onceTime, setOnceTime] = useState("09:00")
  const [recurTime, setRecurTime] = useState("09:00")
  const [dayOfWeek, setDayOfWeek] = useState(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [prompt, setPrompt] = useState("")
  const [taskMode, setTaskMode] = useState<"create" | "reuse">("create")
  const [taskId, setTaskId] = useState<string>("none")
  const [projectId, setProjectId] = useState<string>("none")

  // ── Tool/model fetch state ───────────────────────────────────────
  const [tools, setTools] = useState<ToolOption[]>([])
  const [toolsLoading, setToolsLoading] = useState(true)
  const [toolModels, setToolModels] = useState<ToolModel[]>([])
  const [toolModelsLoading, setToolModelsLoading] = useState(false)

  // ── Delete confirmation ──────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── Run history ────────────────────────────────────────────────
  const [scheduleRuns, setScheduleRuns] = useState<ScheduleRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [viewingRunId, setViewingRunId] = useState<string | null>(null)
  const viewingRun = scheduleRuns.find((r) => r.id === viewingRunId)

  const isEditing = !!editJob

  // ── Fetch tools once on mount ────────────────────────────────────
  useEffect(() => {
    fetch("/api/tools")
      .then((res) => res.json())
      .then((data: ToolOption[]) => setTools(data))
      .catch(() => {
        setTools([{ id: "claude-code", name: "Claude Code", icon: "🟣", adapter: "claude" }])
      })
      .finally(() => setToolsLoading(false))
  }, [])

  // ── Fetch models when tool changes ───────────────────────────────
  useEffect(() => {
    if (!tool) return
    async function load() {
      setToolModelsLoading(true)
      try {
        const res = await fetch(`/api/tools/${encodeURIComponent(tool)}/models`)
        const data: ToolModel[] = await res.json()
        setToolModels(data)
      } catch {
        setToolModels([])
      } finally {
        setToolModelsLoading(false)
      }
    }
    void load()
  }, [tool])

  // ── Fetch run history when editing ──────────────────────────────
  useEffect(() => {
    if (open && editJob) {
      setRunsLoading(true)
      fetchScheduleRuns(editJob.id)
        .then(setScheduleRuns)
        .catch(() => setScheduleRuns([]))
        .finally(() => setRunsLoading(false))
    } else {
      setScheduleRuns([])
    }
  }, [open, editJob])

  // ── Populate form when modal opens ───────────────────────────────
  useEffect(() => {
    if (!open) return

    async function populate() {
      if (editJob) {
        setName(editJob.name)
        setAgentId(editJob.agentConfigId ?? "none")
        setTool(editJob.tool)
        setModel(editJob.model)
        setPreset(editJob.preset)
        setPrompt(editJob.prompt)
        setTaskMode(editJob.taskMode)
        setTaskId(editJob.taskId ?? "none")
        setProjectId(editJob.projectId ?? "none")

        if (editJob.preset === "once" && editJob.scheduledAt) {
          setOnceDate(utcToLocalDate(editJob.scheduledAt))
          setOnceTime(utcToLocalTime(editJob.scheduledAt))
        } else if (editJob.hour != null && editJob.minute != null) {
          setRecurTime(utcHourMinuteToLocalTime(editJob.hour, editJob.minute))
        }
        if (editJob.dayOfWeek != null) setDayOfWeek(editJob.dayOfWeek)
        if (editJob.dayOfMonth != null) setDayOfMonth(editJob.dayOfMonth)
      } else {
        // Reset for create mode
        setName("")
        setAgentId("none")
        setTool("claude-code")
        setModel("")
        setPreset("once")
        setOnceDate(defaultDate ? dateToLocalDateString(defaultDate) : todayLocalDate())
        setOnceTime("09:00")
        setRecurTime("09:00")
        setDayOfWeek(1)
        setDayOfMonth(1)
        setPrompt("")
        setTaskMode("create")
        setTaskId("none")
        setProjectId("none")
      }
    }
    void populate()
  }, [open, editJob, defaultDate])

  // ── When agent selection changes, pre-fill tool/model ────────────
  useEffect(() => {
    if (agentId === "none") return
    async function prefill() {
      const agent = agents.find((a) => a.id === agentId)
      if (agent) {
        setTool(agent.tool)
        setModel(agent.model)
      }
    }
    void prefill()
  }, [agentId, agents])

  // ── Helpers ──────────────────────────────────────────────────────
  function buildPayload() {
    const base = {
      name: name.trim(),
      agentConfigId: agentId === "none" ? null : agentId,
      tool,
      model,
      prompt: prompt.trim(),
      preset,
      taskMode,
      taskId: taskId === "none" ? null : taskId,
      projectId: projectId === "none" ? null : projectId,
    }

    if (preset === "once") {
      return {
        ...base,
        scheduledAt: localDateTimeToUtc(onceDate, onceTime),
        hour: null,
        minute: null,
        dayOfWeek: null,
        dayOfMonth: null,
      }
    }

    if (preset === "hourly") {
      return {
        ...base,
        scheduledAt: null,
        hour: null,
        minute: null,
        dayOfWeek: null,
        dayOfMonth: null,
      }
    }

    const { hour, minute } = localTimeToUtcHourMinute(recurTime)

    if (preset === "daily") {
      return { ...base, scheduledAt: null, hour, minute, dayOfWeek: null, dayOfMonth: null }
    }

    if (preset === "weekly") {
      return { ...base, scheduledAt: null, hour, minute, dayOfWeek, dayOfMonth: null }
    }

    // monthly
    return { ...base, scheduledAt: null, hour, minute, dayOfWeek: null, dayOfMonth }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!prompt.trim()) {
      toast.error("Prompt is required")
      return
    }

    try {
      const payload = buildPayload()
      if (isEditing) {
        await updateSchedule(editJob.id, payload)
        toast.success("Schedule updated")
      } else {
        await createSchedule(payload)
        toast.success("Schedule created")
      }
      await refreshSchedules()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save schedule")
    }
  }

  const handleDelete = async () => {
    if (!editJob) return
    try {
      await deleteSchedule(editJob.id)
      await refreshSchedules()
      toast.success("Schedule deleted")
      setShowDeleteConfirm(false)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete schedule")
    }
  }

  const handleToggle = async () => {
    if (!editJob) return
    try {
      await toggleSchedule(editJob.id)
      await refreshSchedules()
      toast.success(editJob.enabled ? "Schedule disabled" : "Schedule enabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle schedule")
    }
  }

  const showToolModel = agentId === "none"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Schedule" : "New Schedule"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Name
              </label>
              <Input
                placeholder="e.g. Daily standup summary"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="h-10"
              />
            </div>

            {/* Agent */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Agent (optional)
              </label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="No agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No agent</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tool + Model (shown when no agent selected, or always to allow override) */}
            {showToolModel && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Tool
                  </label>
                  <Select
                    value={tool}
                    onValueChange={(v) => {
                      setTool(v)
                      setModel("")
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={toolsLoading ? "Loading…" : "Select tool"} />
                    </SelectTrigger>
                    <SelectContent>
                      {toolsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading tools…
                        </SelectItem>
                      ) : (
                        tools.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.icon} {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Model
                  </label>
                  <Select
                    value={model}
                    onValueChange={setModel}
                    disabled={!tool || toolModelsLoading}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue
                        placeholder={
                          !tool
                            ? "Select a tool first"
                            : toolModelsLoading
                              ? "Loading…"
                              : "Select model"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {toolModelsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading models…
                        </SelectItem>
                      ) : toolModels.length > 0 ? (
                        toolModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No models available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Schedule Preset */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Schedule
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={preset === p ? "default" : "ghost"}
                    className="h-8 text-xs"
                    onClick={() => setPreset(p)}
                    type="button"
                  >
                    {PRESET_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Conditional schedule fields */}
            {preset === "once" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={onceDate}
                    onChange={(e) => setOnceDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={onceTime}
                    onChange={(e) => setOnceTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {preset === "daily" && (
              <div>
                <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                  Time
                </label>
                <Input
                  type="time"
                  value={recurTime}
                  onChange={(e) => setRecurTime(e.target.value)}
                  className="h-9 text-xs w-36"
                />
              </div>
            )}

            {preset === "weekly" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Day of week
                  </label>
                  <Select
                    value={String(dayOfWeek)}
                    onValueChange={(v) => setDayOfWeek(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((day, i) => (
                        <SelectItem key={day} value={String(i)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={recurTime}
                    onChange={(e) => setRecurTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {preset === "monthly" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Day of month
                  </label>
                  <Select
                    value={String(dayOfMonth)}
                    onValueChange={(v) => setDayOfMonth(Number(v))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={recurTime}
                    onChange={(e) => setRecurTime(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Prompt
              </label>
              <Textarea
                placeholder="What should the agent do each run?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none min-h-[80px]"
                rows={3}
              />
            </div>

            {/* Task mode */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Task mode
              </label>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={taskMode === "create" ? "default" : "ghost"}
                  className="h-8 text-xs"
                  onClick={() => setTaskMode("create")}
                  type="button"
                >
                  New task each run
                </Button>
                <Button
                  size="sm"
                  variant={taskMode === "reuse" ? "default" : "ghost"}
                  className="h-8 text-xs"
                  onClick={() => setTaskMode("reuse")}
                  type="button"
                >
                  Reuse task
                </Button>
              </div>
              {taskMode === "reuse" && (
                <div className="mt-2">
                  <Select value={taskId} onValueChange={setTaskId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No task</SelectItem>
                      {tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Project */}
            <div>
              <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">
                Project (optional)
              </label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Edit-mode controls */}
            {isEditing && (
              <div className="flex items-center justify-between pt-2 border-t border-base-300">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-error/70 hover:text-error hover:bg-error/10"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                >
                  Delete schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={handleToggle}
                  type="button"
                >
                  {editJob?.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            )}
          </div>

          {isEditing && scheduleRuns.length > 0 && (
            <div className="space-y-2 border-t border-base-300 pt-3">
              <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                Run History
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {runsLoading && <p className="text-xs text-base-content/50">Loading...</p>}
                {scheduleRuns.map((run) => (
                  <div key={run.id} className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-base-200 rounded px-1 -mx-1" onClick={() => setViewingRunId(run.id)}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      run.status === "COMPLETED" ? "bg-green-400" :
                      run.status === "RUNNING" ? "bg-amber-400 animate-pulse" :
                      run.status === "FAILED" ? "bg-red-400" : "bg-gray-400"
                    }`} />
                    <span className="text-base-content/50 w-28 shrink-0">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </span>
                    {run.task ? (
                      <span className="truncate text-base-content/70">{run.task.title}</span>
                    ) : (
                      <span className="text-base-content/40">No task</span>
                    )}
                    {run.costUsd != null && (
                      <span className="ml-auto text-base-content/40 shrink-0">${run.costUsd.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} type="button">
              {isEditing ? "Save changes" : "Create schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{editJob?.name}&rdquo; and all its run history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-error text-error-content hover:bg-error/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RunLogModal
        runId={viewingRunId}
        runMeta={viewingRun ? {
          model: viewingRun.model,
          status: viewingRun.status,
          startedAt: viewingRun.startedAt ?? undefined,
          costUsd: viewingRun.costUsd,
          tokenCount: viewingRun.tokenCount,
        } : undefined}
        onClose={() => setViewingRunId(null)}
      />
    </>
  )
}
