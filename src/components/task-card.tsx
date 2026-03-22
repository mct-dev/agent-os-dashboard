"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LinearIcon } from "@/components/linear-icon"
import type { Task, AgentRun } from "@/lib/types"
import { PRIORITY_CONFIG, LLM_MODELS } from "@/lib/types"
import { useAppState } from "@/lib/store"
import { startRun } from "@/lib/api-client"
import { toast } from "sonner"

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  const { setSelectedTaskId, setTasks, agents, projects, sops } = useAppState()

  const getSopName = (sopId: string | null): string | null => {
    if (!sopId) return null
    const sop = sops.find((s) => s.id === sopId)
    return sop?.name ?? sopId
  }
  const lastRun = task.runs[task.runs.length - 1] ?? null
  const priority = PRIORITY_CONFIG[task.priority]
  const project = projects.find((p) => p.id === task.projectId)

  // Find the agent assigned via SOP
  const agent = task.sopId ? agents.find((a) => a.defaultSopId === task.sopId) : null

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className="group card bg-base-200 border border-base-300 rounded-lg p-3 cursor-pointer hover:border-base-300/80 transition-all hover:bg-base-300/50"
    >
      {/* Top row: ID + priority + project + kebab */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[11px] text-base-content/60 font-mono">AGT-{task.id}</span>
        <span className={`text-[11px] ${priority.color}`}>{priority.icon}</span>
        {project && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-200 text-base-content/60">
            {project.emoji} {project.name}
          </span>
        )}
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 text-base-content/60 hover:text-base-content text-sm px-1 transition-opacity">
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id) }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-error focus:text-error"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className="text-[13px] text-base-content/90 leading-snug line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Bottom row: agent + SOP + cost */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.sopId && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {getSopName(task.sopId)}
          </Badge>
        )}
        {agent && (
          <span className="text-[11px] text-base-content/60 flex items-center gap-1">
            🤖 {agent.name}
          </span>
        )}
        {lastRun && (
          <>
            <span className={`w-1.5 h-1.5 rounded-full ${
              lastRun.status === "RUNNING" ? "bg-amber-400 animate-pulse" :
              lastRun.status === "COMPLETED" ? "bg-green-400" :
              lastRun.status === "FAILED" ? "bg-red-400" : "bg-gray-400"
            }`} />
            {lastRun.costUsd !== null && (
              <span className="text-[10px] text-emerald-400/70">
                ${lastRun.costUsd.toFixed(2)}
              </span>
            )}
          </>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-base-content/60 hover:text-base-content"
          onClick={async (e) => {
            e.stopPropagation()
            const model = agent?.model ?? LLM_MODELS[0]
            const prompt = [task.title, task.description].filter(Boolean).join("\n\n")
            try {
              const result = await startRun({ taskId: task.id, model, prompt })
              const newRun: AgentRun = {
                id: result.id,
                status: "RUNNING",
                model,
                costUsd: null,
                tokenCount: null,
                startedAt: new Date().toISOString(),
                endedAt: null,
                bridgeRunId: result.bridgeRunId,
                prompt,
                output: null,
                triggerCommentId: null,
                agentConfigId: null,
              }
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id ? { ...t, runs: [...t.runs, newRun] } : t
                )
              )
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to start run")
            }
          }}
        >
          Run
        </Button>
      </div>

      {/* Linear badge row */}
      {task.linearLinks && task.linearLinks.length > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "#5E6AD220", color: "#5E6AD2" }}
          >
            <LinearIcon size={10} />
            {task.linearLinks[0].linearTeamKey}-{task.linearLinks[0].linearIssueNumber}
          </span>
          {task.linearLinks.length > 1 && (
            <span className="text-[11px] text-base-content/50">
              +{task.linearLinks.length - 1} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
