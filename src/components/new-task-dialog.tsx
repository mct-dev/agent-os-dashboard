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
import { useAppState } from "@/lib/store"
import { createTask } from "@/lib/api-client"
import { toast } from "sonner"
import type { Priority, Status } from "@/lib/types"

interface NewTaskDialogProps {
  defaultStatus?: Status
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewTaskDialog({ defaultStatus, open, onOpenChange }: NewTaskDialogProps) {
  const { projects, sops, refreshTasks } = useAppState()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "")
  const [priority, setPriority] = useState<Priority>("MEDIUM")
  const [sopId, setSopId] = useState<string>("none")
  const [status, setStatus] = useState<Status>(defaultStatus ?? "BACKLOG")

  useEffect(() => {
    if (open && defaultStatus) {
      setStatus(defaultStatus)
    }
  }, [open, defaultStatus])

  const handleCreate = async () => {
    if (!title.trim()) return
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId,
        priority,
        status,
        sopId: sopId === "none" ? undefined : sopId,
      })
      await refreshTasks()
      setTitle("")
      setDescription("")
      setPriority("MEDIUM")
      setSopId("none")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-10"
            />
          </div>
          <div>
            <label className="text-xs text-base-content/60 uppercase tracking-wide font-medium mb-1.5 block">Description</label>
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
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sopId} onValueChange={setSopId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="SOP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No SOP</SelectItem>
                {sops.map((sop) => (
                  <SelectItem key={sop.id} value={sop.id}>
                    {sop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SOP Preview */}
          {sopId !== "none" && (
            <div className="bg-base-200 rounded-md p-3 border border-base-300">
              <p className="text-[11px] text-base-content/60 mb-1.5">Pipeline stages:</p>
              <div className="flex items-center gap-1 flex-wrap">
                {sops.find((s) => s.id === sopId)?.stages.map((stage, i) => (
                  <span key={stage.id} className="flex items-center gap-1">
                    <span className="text-[11px] text-base-content/60 bg-base-300 px-1.5 py-0.5 rounded">
                      {stage.name}
                    </span>
                    {i < (sops.find((s) => s.id === sopId)?.stages.length ?? 0) - 1 && (
                      <span className="text-base-content/60 text-[10px]">&rarr;</span>
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
