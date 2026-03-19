"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { STATUS_CONFIG, STATUSES } from "@/lib/types"
import { TaskCard } from "@/components/task-card"
import { TaskPanel } from "@/components/task-panel"
import { NewTaskDialog } from "@/components/new-task-dialog"

export function KanbanBoard() {
  const { tasks, setTasks, projects } = useAppState()
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredTasks = projectFilter === "all"
    ? tasks
    : tasks.filter((t) => t.projectId === projectFilter)

  const handleDelete = () => {
    if (deleteId) {
      setTasks((prev) => prev.filter((t) => t.id !== deleteId))
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white">Board</h1>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-7 text-xs w-36 bg-transparent border-white/10">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NewTaskDialog />
      </header>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 h-full min-w-max">
          {STATUSES.map((status) => {
            const columnTasks = filteredTasks.filter((t) => t.status === status)
            const config = STATUS_CONFIG[status]

            return (
              <div key={status} className="w-[280px] flex flex-col shrink-0">
                {/* Column Header */}
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                  <span className="text-xs font-medium text-white/70">{config.label}</span>
                  <span className="text-[11px] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pb-4">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={setDeleteId}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task Detail Panel */}
      <TaskPanel />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="bg-[#0f0f0f] border-white/[0.06]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete task?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This action cannot be undone. The task and its run history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white/70 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
