"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAppState } from "@/lib/store"
import { PRIORITY_CONFIG } from "@/lib/types"

export function InboxPage() {
  const { inbox, setInbox } = useAppState()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")

  const sortedItems = [...inbox].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const markRead = (id: string) => {
    setInbox((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)))
  }

  const dismiss = (id: string) => {
    setInbox((prev) => prev.filter((i) => i.id !== id))
  }

  const snooze = (id: string) => {
    const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    setInbox((prev) =>
      prev.map((i) => (i.id === id ? { ...i, snoozedUntil, read: true } : i))
    )
  }

  const handleReply = (id: string) => {
    if (!replyText.trim()) return
    dismiss(id)
    setReplyingTo(null)
    setReplyText("")
  }

  return (
    <div className="flex flex-col h-screen">
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px]"
                          onClick={(e) => { e.stopPropagation(); setReplyingTo(item.id) }}
                        >
                          Reply
                        </Button>
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
                          {new Date(item.timestamp).toLocaleString()}
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
