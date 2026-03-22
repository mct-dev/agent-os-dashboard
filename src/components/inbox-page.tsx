"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAppState } from "@/lib/store"
import { PRIORITY_CONFIG } from "@/lib/types"
import {
  updateInboxItem as apiUpdateInboxItem,
  deleteInboxItem as apiDeleteInboxItem,
  approveScheduledRun,
} from "@/lib/api-client"
import { toast } from "sonner"

export function InboxPage() {
  const { inbox, refreshInbox, refreshSchedules } = useAppState()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")

  const sortedItems = [...inbox].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const markRead = async (id: string) => {
    try {
      await apiUpdateInboxItem(id, { read: true })
      await refreshInbox()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as read")
    }
  }

  const dismiss = async (id: string) => {
    try {
      await apiDeleteInboxItem(id)
      await refreshInbox()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss item")
    }
  }

  const snooze = useCallback(async (id: string) => {
    const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    try {
      await apiUpdateInboxItem(id, { snoozedUntil })
      await refreshInbox()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to snooze item")
    }
  }, [refreshInbox])

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return
    try {
      await apiUpdateInboxItem(id, {
        replyText: replyText.trim(),
        repliedAt: new Date().toISOString(),
      })
      await refreshInbox()
      setReplyingTo(null)
      setReplyText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply")
    }
  }

  const handleApproveRun = async (id: string) => {
    try {
      await approveScheduledRun(id)
      await refreshInbox()
      await refreshSchedules()
      toast.success("Run dispatched")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve run")
    }
  }

  return (
    <div className="flex flex-col h-screen min-w-0">
      <header className="shrink-0 border-b border-base-300 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-base-content">Inbox</h1>
          <span className="text-[11px] text-base-content/60">
            {inbox.filter((i) => !i.read).length} unread
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-base-content/60">
            <span className="text-3xl mb-3">🎉</span>
            <p className="text-sm">All clear — no pending items</p>
          </div>
        ) : (
          sortedItems.map((item) => {
            const priority = PRIORITY_CONFIG[item.priority]
            return (
              <div
                key={item.id}
                className={`bg-base-200 border rounded-lg p-4 transition-all ${
                  item.read ? "border-base-300/50 opacity-60" : "border-base-300"
                }`}
                onClick={() => markRead(item.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <div className="pt-1.5 shrink-0">
                    {!item.read && <span className="block w-2 h-2 rounded-full bg-primary" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-base-content/80">🤖 {item.agentName}</span>
                      <span className="text-[11px] text-base-content/60">on</span>
                      <span className="text-xs text-base-content/60 truncate">{item.taskTitle}</span>
                      {item.action === "approve_run" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 shrink-0 border-primary/50 text-primary"
                        >
                          📅 Scheduled
                        </Badge>
                      )}
                      <Badge
                        variant={
                          item.priority === "URGENT" ? "destructive" :
                          item.priority === "HIGH" ? "destructive" :
                          "outline"
                        }
                        className="text-[10px] px-1.5 py-0 h-5 ml-auto shrink-0"
                      >
                        {priority.icon} {priority.label}
                      </Badge>
                    </div>

                    {/* Question */}
                    <p className="text-[13px] text-base-content/70 leading-relaxed mb-3">
                      {item.question}
                    </p>

                    {/* Reply area */}
                    {replyingTo === item.id ? (
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          className="flex-1 h-8 text-xs"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleReply(item.id) }}
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleReply(item.id)}
                        >
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => { setReplyingTo(null); setReplyText("") }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {item.action === "approve_run" ? (
                          <Button
                            size="sm"
                            className="h-6 text-[11px] btn-primary btn-sm"
                            onClick={(e) => { e.stopPropagation(); handleApproveRun(item.id) }}
                          >
                            Approve &amp; Run
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); setReplyingTo(item.id) }}
                          >
                            Reply
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-base-content/60"
                          onClick={(e) => { e.stopPropagation(); snooze(item.id) }}
                        >
                          Snooze 1h
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-base-content/60"
                          onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}
                        >
                          Dismiss
                        </Button>
                        <span className="ml-auto text-[10px] text-base-content/30">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
