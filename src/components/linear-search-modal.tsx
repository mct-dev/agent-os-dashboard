"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { LinearIcon } from "@/components/linear-icon"
import {
  searchLinearIssues,
  fetchLinearTeams,
  fetchLinearUsers,
  fetchLinearLabels,
  fetchLinearStatuses,
} from "@/lib/api-client"
import type { LinearSearchResult, LinearTeam, LinearUser, LinearLabel } from "@/lib/types"
import type { LinearStatus } from "@/lib/api-client"

type SortKey = "updated" | "priority" | "created" | "identifier"

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
  const [assigneeId, setAssigneeId] = useState("all")
  const [labelId, setLabelId] = useState("all")
  const [statusName, setStatusName] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("updated")
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [users, setUsers] = useState<LinearUser[]>([])
  const [labels, setLabels] = useState<LinearLabel[]>([])
  const [statuses, setStatuses] = useState<LinearStatus[]>([])
  const [results, setResults] = useState<LinearSearchResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLinearTeams().then(setTeams).catch(() => {})
      fetchLinearUsers().then(setUsers).catch(() => {})
      fetchLinearLabels().then(setLabels).catch(() => {})
      fetchLinearStatuses().then(setStatuses).catch(() => {})
    }
  }, [open])

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const issues = await searchLinearIssues({
        q: query || undefined,
        teamId: teamId !== "all" ? teamId : undefined,
        assigneeId: assigneeId !== "all" ? assigneeId : undefined,
        labelId: labelId !== "all" ? labelId : undefined,
        statusName: statusName !== "all" ? statusName : undefined,
      })
      setResults(issues)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, teamId, assigneeId, labelId, statusName])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query, teamId, assigneeId, labelId, statusName, open, search])

  const sortedResults = useMemo(() => {
    const sorted = [...results]
    switch (sortBy) {
      case "priority":
        sorted.sort((a, b) => a.priority - b.priority)
        break
      case "created":
        sorted.sort((a, b) => b.number - a.number)
        break
      case "identifier":
        sorted.sort((a, b) => a.identifier.localeCompare(b.identifier))
        break
      case "updated":
      default:
        // API returns in updated order by default
        break
    }
    return sorted
  }, [results, sortBy])

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

  const teamOptions = useMemo(() => teams.map((t) => ({
    value: t.id,
    label: `${t.key} — ${t.name}`,
  })), [teams])

  const userOptions = useMemo(() => users.map((u) => ({
    value: u.id,
    label: u.displayName || u.name,
  })), [users])

  const labelOptions = useMemo(() => labels.map((l) => ({
    value: l.id,
    label: l.name,
    icon: <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />,
  })), [labels])

  const statusOptions = useMemo(() => statuses.map((s) => ({
    value: s.name,
    label: s.name,
    icon: <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />,
  })), [statuses])

  const statusColors: Record<string, string> = {
    "In Progress": "badge-warning",
    Todo: "badge-info",
    Done: "badge-success",
    Backlog: "badge-ghost",
    Cancelled: "badge-error",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinearIcon size={18} />
            {title ?? (mode === "import" ? "Import from Linear" : "Link Linear Issue")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="Search Linear issues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-2">
            <SearchableSelect
              value={teamId}
              onValueChange={setTeamId}
              options={teamOptions}
              allLabel="All Teams"
              placeholder="Team"
              className="flex-1"
            />
            <SearchableSelect
              value={assigneeId}
              onValueChange={setAssigneeId}
              options={userOptions}
              allLabel="All Assignees"
              placeholder="Assignee"
              className="flex-1"
            />
            <SearchableSelect
              value={statusName}
              onValueChange={setStatusName}
              options={statusOptions}
              allLabel="All Statuses"
              placeholder="Status"
              className="flex-1"
            />
            <SearchableSelect
              value={labelId}
              onValueChange={setLabelId}
              options={labelOptions}
              allLabel="All Labels"
              placeholder="Label"
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-base-content/40">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-base-content/40">Sort:</span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-6 text-[11px] w-28 border-base-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last Updated</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="created">Newest First</SelectItem>
                <SelectItem value="identifier">Identifier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
          {loading && (
            <div className="p-4 text-center text-sm text-base-content/50">Searching...</div>
          )}
          {!loading && sortedResults.length === 0 && (
            <div className="p-4 text-center text-sm text-base-content/50">
              {query ? "No issues found" : "Type to search or use filters"}
            </div>
          )}
          {sortedResults.map((issue) => (
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
              {issue.assignee && (
                <span className="text-[10px] text-base-content/40 shrink-0">{issue.assignee}</span>
              )}
              {issue.labels && issue.labels.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {issue.labels.slice(0, 2).map((l) => (
                    <span
                      key={l.id}
                      className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: l.color + "20", color: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
              <span className={`badge badge-xs shrink-0 ${statusColors[issue.status] ?? "badge-ghost"}`}>
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
