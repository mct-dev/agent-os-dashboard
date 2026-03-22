"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LinearIcon } from "@/components/linear-icon"
import { searchLinearIssues, fetchLinearTeams } from "@/lib/api-client"
import type { LinearSearchResult, LinearTeam } from "@/lib/types"

interface LinearSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (issues: LinearSearchResult[]) => void
  mode: "import" | "link"
  title?: string
}

export function LinearSearchModal({
  open,
  onOpenChange,
  onSelect,
  mode,
  title,
}: LinearSearchModalProps) {
  const [query, setQuery] = useState("")
  const [teamId, setTeamId] = useState("all")
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [results, setResults] = useState<LinearSearchResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLinearTeams().then(setTeams).catch(() => {})
    }
  }, [open])

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const issues = await searchLinearIssues({
        q: query || undefined,
        teamId: teamId !== "all" ? teamId : undefined,
      })
      setResults(issues)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, teamId])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query, teamId, open, search])

  function toggleIssue(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const selectedIssues = results.filter((r) => selected.has(r.id))
    onSelect(selectedIssues)
    setSelected(new Set())
    setQuery("")
    onOpenChange(false)
  }

  const statusColors: Record<string, string> = {
    "In Progress": "badge-warning",
    Todo: "badge-info",
    Done: "badge-success",
    Backlog: "badge-ghost",
    Cancelled: "badge-error",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinearIcon size={18} />
            {title ?? (mode === "import" ? "Import from Linear" : "Link Linear Issue")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <input
            className="input input-bordered input-sm flex-1"
            placeholder="Search Linear issues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.key} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
          {loading && (
            <div className="p-4 text-center text-sm text-base-content/50">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-sm text-base-content/50">
              {query ? "No issues found" : "Type to search Linear issues"}
            </div>
          )}
          {results.map((issue) => (
            <label
              key={issue.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-base-200 transition-colors ${
                selected.has(issue.id) ? "bg-primary/5" : ""
              }`}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={selected.has(issue.id)}
                onChange={() => toggleIssue(issue.id)}
              />
              <span className="text-xs font-semibold text-primary w-16 shrink-0">
                {issue.identifier}
              </span>
              <span className="text-sm flex-1 truncate">{issue.title}</span>
              <span className={`badge badge-xs ${statusColors[issue.status] ?? "badge-ghost"}`}>
                {issue.status}
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-base-content/50">
            {selected.size} selected
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            {mode === "import"
              ? `Import ${selected.size} Issue${selected.size !== 1 ? "s" : ""}`
              : `Link ${selected.size} Issue${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
