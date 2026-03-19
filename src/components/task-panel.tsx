"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUSES, type Status, type Priority } from "@/lib/types"
import { SOPS } from "@/lib/sops"

export function TaskPanel() {
  const { selectedTaskId, setSelectedTaskId, tasks, setTasks, projects } = useAppState()
  const task = tasks.find((t) => t.id === selectedTaskId)

  const updateTask = (updates: Partial<typeof task>) => {
    if (!task) return
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t))
    )
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) setSelectedTaskId(null) }}>
      <SheetContent className="w-[480px] sm:w-[520px] overflow-y-auto">
        {task && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono mb-1">
                <span>AGT-{task.id}</span>
                <span className={PRIORITY_CONFIG[task.priority].color}>
                  {PRIORITY_CONFIG[task.priority].icon} {task.priority}
                </span>
              </div>
              <SheetTitle>
                <Input
                  value={task.title}
                  onChange={(e) => updateTask({ title: e.target.value })}
                  className="text-lg font-semibold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
                />
              </SheetTitle>
            </SheetHeader>

            {/* Start Run */}
            <Button className="w-full mb-4" size="lg">
              ▶ Start Run
            </Button>

            {/* Metadata */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground w-20">Status</span>
                <Select
                  value={task.status}
                  onValueChange={(v) => updateTask({ status: v as Status })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
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
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground w-20">Priority</span>
                <Select
                  value={task.priority}
                  onValueChange={(v) => updateTask({ priority: v as Priority })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
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
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground w-20">Project</span>
                <Select
                  value={task.projectId}
                  onValueChange={(v) => updateTask({ projectId: v })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
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
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground w-20">SOP</span>
                <Select
                  value={task.sopId ?? "none"}
                  onValueChange={(v) => updateTask({ sopId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {SOPS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Description */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground block mb-2">Description</label>
              <Textarea
                value={task.description ?? ""}
                onChange={(e) => updateTask({ description: e.target.value || null })}
                placeholder="Add a description..."
                className="text-sm min-h-[100px] resize-none"
                rows={4}
              />
            </div>

            <Separator className="mb-4" />

            {/* Run History */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Run History
              </h3>
              {task.runs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No runs yet</p>
              ) : (
                <div className="space-y-2">
                  {task.runs.map((run) => (
                    <div
                      key={run.id}
                      className="bg-muted rounded-md p-3 border border-border"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{run.model}</span>
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
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                          <div className="bg-background rounded p-2 h-20 flex items-center justify-center border border-border">
                            <span className="text-[11px] text-muted-foreground animate-pulse">
                              ● Streaming output...
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-6 text-[11px] text-destructive"
                          >
                            ■ Stop
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
