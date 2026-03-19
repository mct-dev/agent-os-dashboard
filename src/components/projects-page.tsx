"use client"

import { useState } from "react"
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
import type { Project } from "@/lib/types"

const COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7",
  "#f97316", "#06b6d4", "#ec4899", "#94a3b8", "#8b5cf6",
]

const EMOJIS = ["🔵", "🟢", "🟡", "🔴", "🟣", "🟠", "⚪", "⭐", "🔥", "💎", "🎯", "📦"]

export function ProjectsPage() {
  const { projects, setProjects, tasks } = useAppState()
  const [editing, setEditing] = useState<Project | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) {
      setProjects((prev) => [...prev, editing])
    } else {
      setProjects((prev) => prev.map((p) => (p.id === editing.id ? editing : p)))
    }
    setEditing(null)
  }

  const handleDelete = () => {
    if (deleteId) {
      setProjects((prev) => prev.filter((p) => p.id !== deleteId))
      setDeleteId(null)
    }
  }

  const deleteProject = projects.find((p) => p.id === deleteId)
  const deleteTaskCount = deleteId ? tasks.filter((t) => t.projectId === deleteId).length : 0

  return (
    <div className="flex flex-col h-screen">
      <header className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Projects</h1>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          onClick={openNew}
        >
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
                className="bg-[#141414] border border-white/[0.06] rounded-lg p-4 hover:border-white/[0.1] transition-colors cursor-pointer"
                onClick={() => openEdit(project)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{project.emoji}</span>
                    <h3 className="text-sm font-medium text-white">{project.name}</h3>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-red-400/60 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(project.id) }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.06] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isNew ? "New Project" : "Edit Project"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-white/40 block mb-1">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-white/40 block mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setEditing({ ...editing, emoji })}
                      className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all ${
                        editing.emoji === emoji
                          ? "bg-white/[0.1] ring-1 ring-white/20"
                          : "hover:bg-white/[0.05]"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/40 block mb-2">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditing({ ...editing, color })}
                      className={`w-7 h-7 rounded-full transition-all ${
                        editing.color === color ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[#0f0f0f]" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isNew ? "Create Project" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="bg-[#0f0f0f] border-white/[0.06]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {deleteProject?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {deleteTaskCount > 0
                ? `${deleteTaskCount} task${deleteTaskCount !== 1 ? "s" : ""} will be unassigned. This cannot be undone.`
                : "This project will be permanently removed."}
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
