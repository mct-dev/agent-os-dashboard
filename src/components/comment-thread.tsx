"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MarkdownHooks } from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import { useAppState } from "@/lib/store"
import { fetchComments, createComment } from "@/lib/api-client"
import type { Comment, AgentConfig } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

// ── Helpers ──────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function resolveAuthorName(
  comment: Comment,
  agents: AgentConfig[]
): string {
  if (comment.agentId) {
    const agent = agents.find((a) => a.id === comment.agentId)
    return agent?.name ?? "Agent"
  }
  return comment.userId ?? "User"
}

// ── CommentInput ─────────────────────────────────────────────────────

function CommentInput({
  taskId,
  projectId,
  agentRunId,
  onCommentAdded,
}: {
  taskId?: string
  projectId?: string
  agentRunId?: string
  onCommentAdded: (comment: Comment) => void
}) {
  const { agents } = useAppState()
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredAgents = mentionQuery !== null
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : []

  const closeMention = useCallback(() => {
    setMentionQuery(null)
    setMentionIndex(0)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (mentionQuery === null) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target)
      ) {
        closeMention()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [mentionQuery, closeMention])

  function insertMention(agent: AgentConfig) {
    const textarea = textareaRef.current
    if (!textarea) return

    // Find the @ trigger position by scanning backwards from cursor
    const cursorPos = textarea.selectionStart
    const textBefore = body.slice(0, cursorPos)
    const atIndex = textBefore.lastIndexOf("@")

    if (atIndex === -1) return

    const before = body.slice(0, atIndex)
    const after = body.slice(cursorPos)
    const newBody = `${before}@${agent.name} ${after}`

    setBody(newBody)
    closeMention()

    // Restore focus and set cursor after the inserted mention
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = atIndex + agent.name.length + 2 // @name + space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Cmd/Ctrl+Enter
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Mention dropdown keyboard navigation
    if (mentionQuery !== null && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((prev) =>
          prev < filteredAgents.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredAgents.length - 1
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(filteredAgents[mentionIndex])
        return
      }
    }

    if (e.key === "Escape" && mentionQuery !== null) {
      e.preventDefault()
      closeMention()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setBody(value)

    const cursorPos = e.target.selectionStart
    const textBefore = value.slice(0, cursorPos)

    // Check for an active @ trigger: find the last @ that isn't preceded by a word char
    const match = textBefore.match(/(^|[^a-zA-Z0-9])@([a-zA-Z0-9_-]*)$/)
    if (match) {
      setMentionQuery(match[2])
      setMentionIndex(0)
    } else {
      closeMention()
    }
  }

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    try {
      const comment = await createComment({
        body: trimmed,
        taskId,
        projectId,
        agentRunId,
      })
      onCommentAdded(comment)
      setBody("")
      closeMention()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post comment"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative">
      {/* @-mention dropdown */}
      {mentionQuery !== null && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-base-100 border border-base-300 rounded-md shadow-lg max-h-40 overflow-y-auto z-10"
        >
          {filteredAgents.map((agent, i) => (
            <button
              key={agent.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-base-200 ${
                i === mentionIndex ? "bg-base-200" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(agent)
              }}
            >
              <span>🤖</span>
              <span>{agent.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (@ to mention)"
          className="textarea textarea-bordered flex-1 text-sm min-h-[60px] resize-none leading-relaxed"
          rows={2}
          disabled={isSubmitting}
        />
        <Button
          variant="default"
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
        >
          {isSubmitting ? "..." : "Send"}
        </Button>
      </div>
    </div>
  )
}

// ── CommentThread ────────────────────────────────────────────────────

export function CommentThread({
  taskId,
  projectId,
  agentRunId,
}: {
  taskId?: string
  projectId?: string
  agentRunId?: string
}) {
  const { agents } = useAppState()
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  // Fetch comments and poll every 5 seconds
  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await fetchComments({ taskId, projectId, agentRunId })
        if (active) {
          setComments(data)
          setIsLoading(false)
        }
      } catch {
        if (active) setIsLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 5_000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [taskId, projectId, agentRunId])

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (comments.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = comments.length
  }, [comments.length])

  function handleCommentAdded(comment: Comment) {
    setComments((prev) => [...prev, comment])
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs text-base-content/60 uppercase tracking-wide font-medium">
        Comments
      </h3>

      {/* Comment list */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto space-y-2"
      >
        {isLoading ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-dots loading-sm" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-base-content/50 py-4 text-center">
            No comments yet
          </p>
        ) : (
          comments.map((comment) => {
            const isAgent = !!comment.agentId
            const hasActiveRun = comment.triggeredRuns?.some(
              (r) => r.status === "RUNNING" || r.status === "PENDING"
            )

            return (
              <div
                key={comment.id}
                className={`rounded-md px-3 py-2 ${
                  isAgent
                    ? "bg-primary/5 border border-primary/10"
                    : "bg-base-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm" aria-hidden>
                    {isAgent ? "🤖" : "👤"}
                  </span>
                  <span className="text-xs font-medium text-base-content/80">
                    {resolveAuthorName(comment, agents)}
                  </span>
                  <span className="text-xs text-base-content/40">
                    {formatTimestamp(comment.createdAt)}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-sm text-base-content/90 [&_p]:m-0 [&_pre]:text-xs [&_code]:text-xs">
                  <MarkdownHooks rehypePlugins={[rehypeSanitize]}>
                    {comment.body}
                  </MarkdownHooks>
                </div>
                {hasActiveRun && (
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-base-content/50">
                    <span className="loading loading-dots loading-xs" />
                    <span>Agent thinking...</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <CommentInput
        taskId={taskId}
        projectId={projectId}
        agentRunId={agentRunId}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  )
}
