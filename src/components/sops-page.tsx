"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import type { SOP, BMADStage } from "@/lib/sops"

function StageBuilder({
  stages,
  onChange,
}: {
  stages: BMADStage[]
  onChange: (stages: BMADStage[]) => void
}) {
  const addStage = () => {
    onChange([
      ...stages,
      { id: `stage-${Date.now()}`, name: "", role: "", prompt: "" },
    ])
  }

  const removeStage = (idx: number) => {
    onChange(stages.filter((_, i) => i !== idx))
  }

  const updateStage = (idx: number, updates: Partial<BMADStage>) => {
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...updates } : s)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/40">Pipeline Stages</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[11px] border-white/10"
          onClick={addStage}
        >
          + Add Stage
        </Button>
      </div>
      {stages.map((stage, i) => (
        <div key={stage.id} className="bg-white/[0.03] border border-white/[0.06] rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 w-5">{i + 1}.</span>
            <Input
              value={stage.name}
              onChange={(e) => updateStage(i, { name: e.target.value })}
              placeholder="Stage name"
              className="h-7 text-xs bg-transparent border-white/10 flex-1"
            />
            <Input
              value={stage.role}
              onChange={(e) => updateStage(i, { role: e.target.value })}
              placeholder="Agent role"
              className="h-7 text-xs bg-transparent border-white/10 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-red-400/60 hover:text-red-400 px-1.5"
              onClick={() => removeStage(i)}
            >
              ✕
            </Button>
          </div>
          <Textarea
            value={stage.prompt}
            onChange={(e) => updateStage(i, { prompt: e.target.value })}
            placeholder="System prompt for this stage..."
            className="bg-transparent border-white/[0.06] text-xs resize-none min-h-[60px]"
            rows={2}
          />
        </div>
      ))}
      {stages.length === 0 && (
        <p className="text-xs text-white/20 text-center py-4">
          No stages yet — add one to define your pipeline
        </p>
      )}
    </div>
  )
}

export function SOPsPage() {
  const { sops, setSops } = useAppState()
  const [editingSop, setEditingSop] = useState<SOP | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openNew = () => {
    setEditingSop({
      id: `sop-${Date.now()}`,
      name: "",
      description: "",
      stages: [],
    })
    setIsNew(true)
  }

  const openEdit = (sop: SOP) => {
    setEditingSop({ ...sop, stages: sop.stages.map((s) => ({ ...s })) })
    setIsNew(false)
  }

  const handleSave = () => {
    if (!editingSop || !editingSop.name.trim()) return
    if (isNew) {
      setSops((prev) => [...prev, editingSop])
    } else {
      setSops((prev) => prev.map((s) => (s.id === editingSop.id ? editingSop : s)))
    }
    setEditingSop(null)
  }

  const handleDelete = () => {
    if (deleteId) {
      setSops((prev) => prev.filter((s) => s.id !== deleteId))
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">SOPs / Pipelines</h1>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          onClick={openNew}
        >
          + New SOP
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sops.map((sop) => (
          <div
            key={sop.id}
            className="bg-[#141414] border border-white/[0.06] rounded-lg p-4 hover:border-white/[0.1] transition-colors cursor-pointer"
            onClick={() => openEdit(sop)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-white">{sop.name}</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-white/5 text-white/40 border-white/10">
                  {sop.stages.length} stages
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-red-400/60 hover:text-red-400"
                onClick={(e) => { e.stopPropagation(); setDeleteId(sop.id) }}
              >
                Delete
              </Button>
            </div>
            <p className="text-xs text-white/40 mb-3">{sop.description}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {sop.stages.map((stage, i) => (
                <span key={stage.id} className="flex items-center gap-1">
                  <span className="text-[11px] text-white/50 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    {stage.name}
                  </span>
                  {i < sop.stages.length - 1 && (
                    <span className="text-white/20 text-[10px]">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editingSop} onOpenChange={(open) => { if (!open) setEditingSop(null) }}>
        <DialogContent className="bg-[#0f0f0f] border-white/[0.06] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isNew ? "Create SOP" : "Edit SOP"}
            </DialogTitle>
          </DialogHeader>
          {editingSop && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-white/40 block mb-1">Name</label>
                <Input
                  value={editingSop.name}
                  onChange={(e) => setEditingSop({ ...editingSop, name: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Description</label>
                <Input
                  value={editingSop.description}
                  onChange={(e) => setEditingSop({ ...editingSop, description: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06]"
                />
              </div>
              <StageBuilder
                stages={editingSop.stages}
                onChange={(stages) => setEditingSop({ ...editingSop, stages })}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isNew ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="bg-[#0f0f0f] border-white/[0.06]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete SOP?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will permanently remove this SOP pipeline. Tasks using it won&apos;t be affected.
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
