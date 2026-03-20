"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppState } from "@/lib/store"
import { SOPS } from "@/lib/sops"
import { createTask } from "@/lib/api-client"
import { toast } from "sonner"
import type { Priority } from "@/lib/types"

export function NewTaskDialog() {
  const { projects, refreshTasks } = useAppState()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [priority, setPriority] = useState<Priority>("MEDIUM")
  const [sopId, setSopId] = useState<string>("none")

  const handleCreate = async () => {
    if (!title.trim()) return
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
        priority,
        sopId: sopId === "none" ? undefined : sopId,
      })
      await refreshTasks()
      setTitle("")
      setDescription("")
      setPriority("MEDIUM")
      setSopId("none")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          + New Issue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none min-h-[80px]"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URGENT">⬆ Urgent</SelectItem>
                <SelectItem value="HIGH">↑ High</SelectItem>
                <SelectItem value="MEDIUM">→ Medium</SelectItem>
                <SelectItem value="LOW">↓ Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sopId} onValueChange={setSopId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="SOP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No SOP</SelectItem>
                {SOPS.map((sop) => (
                  <SelectItem key={sop.id} value={sop.id}>
                    {sop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SOP Preview */}
          {sopId !== "none" && (
            <div className="bg-muted rounded-md p-3 border border-border">
              <p className="text-[11px] text-muted-foreground mb-1.5">Pipeline stages:</p>
              <div className="flex items-center gap-1 flex-wrap">
                {SOPS.find((s) => s.id === sopId)?.stages.map((stage, i) => (
                  <span key={stage.id} className="flex items-center gap-1">
                    <span className="text-[11px] text-foreground/60 bg-accent px-1.5 py-0.5 rounded">
                      {stage.name}
                    </span>
                    {i < (SOPS.find((s) => s.id === sopId)?.stages.length ?? 0) - 1 && (
                      <span className="text-muted-foreground text-[10px]">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate}>
            Create Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
