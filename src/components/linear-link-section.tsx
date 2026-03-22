"use client"

import { useState } from "react"
import { LinearIcon } from "@/components/linear-icon"
import { LinearSearchModal } from "@/components/linear-search-modal"
import {
  createLinearLink,
  deleteLinearLink,
  syncLinearLinks,
} from "@/lib/api-client"
import type { Task, LinearLink, LinearSearchResult } from "@/lib/types"
import { toast } from "sonner"
import { useAppState } from "@/lib/store"

interface LinearLinkSectionProps {
  task: Task
}

export function LinearLinkSection({ task }: LinearLinkSectionProps) {
  const { setTasks } = useAppState()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const links = task.linearLinks ?? []

  async function handleLink(issues: LinearSearchResult[]) {
    try {
      for (const issue of issues) {
        const link = await createLinearLink(task.id, issue.id)
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, linearLinks: [...(t.linearLinks ?? []), link] }
              : t
          )
        )
      }
      toast.success(`Linked ${issues.length} issue${issues.length !== 1 ? "s" : ""}`)
    } catch {
      toast.error("Failed to link issue")
    }
  }

  async function handleUnlink(linkId: string) {
    try {
      await deleteLinearLink(task.id, linkId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, linearLinks: (t.linearLinks ?? []).filter((l: LinearLink) => l.id !== linkId) }
            : t
        )
      )
      toast.success("Issue unlinked")
    } catch {
      toast.error("Failed to unlink issue")
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const updated = await syncLinearLinks(task.id)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, linearLinks: updated } : t
        )
      )
      toast.success("Linear data refreshed")
    } catch {
      toast.error("Failed to refresh")
    } finally {
      setSyncing(false)
    }
  }

  const statusColors: Record<string, string> = {
    "In Progress": "badge-warning",
    Todo: "badge-info",
    Done: "badge-success",
    Backlog: "badge-ghost",
    Cancelled: "badge-error",
  }

  const oldestSync = links.length > 0
    ? new Date(Math.min(...links.map((l) => new Date(l.syncedAt).getTime())))
    : null

  function timeAgo(date: Date): string {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
          <LinearIcon size={14} />
          Linked Linear Issues
        </h3>
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setLinkModalOpen(true)}
        >
          + Link Issue
        </button>
      </div>

      {links.length > 0 && (
        <>
          <div className="border border-base-300 rounded-lg divide-y divide-base-300 overflow-hidden">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 px-2.5 py-2">
                <a
                  href={link.linearIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  {link.linearTeamKey}-{link.linearIssueNumber}
                </a>
                <span className="text-xs flex-1 truncate text-base-content/80">
                  {link.linearTitle}
                </span>
                {link.linearStatus && (
                  <span className={`badge badge-xs ${statusColors[link.linearStatus] ?? "badge-ghost"}`}>
                    {link.linearStatus}
                  </span>
                )}
                <button
                  className="text-base-content/30 hover:text-error text-xs shrink-0"
                  onClick={() => handleUnlink(link.id)}
                  title="Unlink"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-base-content/40">
              {oldestSync && `Synced ${timeAgo(oldestSync)}`}
            </span>
            <button
              className="text-[11px] text-primary hover:underline disabled:opacity-50"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </>
      )}

      {links.length === 0 && (
        <p className="text-xs text-base-content/40">No linked issues</p>
      )}

      <LinearSearchModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        onSelect={handleLink}
        mode="link"
      />
    </div>
  )
}
