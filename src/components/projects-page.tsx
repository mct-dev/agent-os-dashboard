"use client"

import { useState } from "react"
import { CommentThread } from "@/components/comment-thread"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
} from "@/lib/api-client"
import { toast } from "sonner"
import type { Project } from "@/lib/types"

const COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#94a3b8", "#8b5cf6",
]

const EMOJIS = ["🔵", "🟢", "🟡", "🔴", "🟣", "🟠", "⚪", "⭐", "🔥", "💎", "🎯", "📦"]

export function ProjectsPage() {
  const { projects, tasks, refreshProjects } = useAppState()
  const [editing, setEditing] = useState<Project | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [commentProjectId, setCommentProjectId] = useState<string | null>(null)

  const openNew = () => {
    setEditing({
      id: `proj-${Date.now()}`,
      name: "",
      color: COLORS[0],
      emoji: "📦",
    })
    setIsNew(true)
  }

  const openEdit = (project: Project) => {
    setEditing({ ...project })
    setIsNew(false)
  }

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      if (isNew) {
        await apiCreateProject({ name: editing.name, color: editing.color, emoji: editing.emoji })
      } else {
        await apiUpdateProject(editing.id, { name: editing.name, color: editing.color, emoji: editing.emoji })
      }
      await refreshProjects()
      setEditing(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save project")
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await apiDeleteProject(deleteId)
      await refreshProjects()
      setDeleteId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project")
    }
  }

  const deleteProject = projects.find((p) => p.id === deleteId)
  const deleteTaskCount = deleteId ? tasks.filter((t) => t.projectId === deleteId).length : 0

  return (
    <div className="flex flex-col h-screen min-w-0">
      <header className="shrink-0 border-b border-base-300 px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-base-content">Projects</h1>
        <Button size="sm" onClick={openNew}>
          + New Project
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project) => {
            const taskCount = tasks.filter((t) => t.projectId === project.id).length
            return (
              <div
                key={project.id}
                className="bg-base-200 border border-base-300 rounded-lg p-4 hover:border-base-300/80 transition-colors cursor-pointer"
                onClick={() => openEdit(project)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{project.emoji}</span>
                    <h3 className="text-sm font-medium text-base-content">{project.name}</h3>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-base-content/60">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-error/60 hover:text-error"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(project.id) }}
                  >
                    Delete
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    className="text-[10px] text-base-content/40 hover:text-base-content/60"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCommentProjectId(commentProjectId === project.id ? null : project.id)
                    }}
                  >
                    {commentProjectId === project.id ? "Hide comments" : "Comments"}
                  </button>
                </div>
                {commentProjectId === project.id && (
                  <div className="mt-3 pt-3 border-t border-base-300">
                    <CommentThread projectId={project.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "New Project" : "Edit Project"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-base-content/60 block mb-1">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-base-content/60 block mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setEditing({ ...editing, emoji })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all ${
                        editing.emoji === emoji
                          ? "bg-base-300 ring-1 ring-primary"
                          : "hover:bg-base-300/50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Type any emoji"
                    value={EMOJIS.includes(editing.emoji) ? "" : editing.emoji}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) setEditing({ ...editing, emoji: val.slice(-2) });
                    }}
                    className="input input-bordered input-sm w-28 text-center text-lg h-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-base-content/60 block mb-2">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditing({ ...editing, color })}
                      className={`w-7 h-7 rounded-full transition-all ${
                        editing.color === color ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSave}>
              {isNew ? "Create Project" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteProject?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTaskCount > 0
                ? `${deleteTaskCount} task${deleteTaskCount !== 1 ? "s" : ""} will be unassigned. This cannot be undone.`
                : "This project will be permanently removed."}
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
    </div>
  )
}
