"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LinearSearchModal } from "@/components/linear-search-modal"
import { importLinearIssues } from "@/lib/api-client"
import { useAppState } from "@/lib/store"
import type { LinearSearchResult } from "@/lib/types"
import { toast } from "sonner"

interface LinearImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LinearImportModal({ open, onOpenChange }: LinearImportModalProps) {
  const { projects, refreshTasks } = useAppState()
  const [projectId, setProjectId] = useState<string>("none")

  async function handleSelect(issues: LinearSearchResult[]) {
    try {
      const pid = projectId !== "none" ? projectId : undefined
      await importLinearIssues(
        issues.map((i) => i.id),
        pid
      )
      await refreshTasks()
      toast.success(`Imported ${issues.length} issue${issues.length !== 1 ? "s" : ""}`)
      onOpenChange(false)
    } catch {
      toast.error("Failed to import issues")
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-base-200 border border-base-300 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
          <span className="text-xs text-base-content/60">Assign to project:</span>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-7 text-xs w-40">
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
      )}
      <LinearSearchModal
        open={open}
        onOpenChange={onOpenChange}
        onSelect={handleSelect}
        mode="import"
      />
    </>
  )
}
