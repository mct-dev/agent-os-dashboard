"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Task } from "@/lib/types"
import { PRIORITY_CONFIG } from "@/lib/types"
import { useAppState } from "@/lib/store"
import { SOPS } from "@/lib/sops"

function getSopName(sopId: string | null): string | null {
  if (!sopId) return null
  const sop = SOPS.find((s) => s.id === sopId)
  return sop?.name ?? sopId
}

interface TaskCardProps {
  task: Task
  onDelete: (id: string) => void
}

export function TaskCard({ task, onDelete }: TaskCardProps) {
  const { setSelectedTaskId, agents, projects } = useAppState()
  const lastRun = task.runs[task.runs.length - 1] ?? null
  const priority = PRIORITY_CONFIG[task.priority]
  const project = projects.find((p) => p.id === task.projectId)

  // Find the agent assigned via SOP
  const agent = task.sopId ? agents.find((a) => a.defaultSopId === task.sopId) : null

  return (
    <div
      onClick={() => setSelectedTaskId(task.id)}
      className="group bg-[#141414] border border-white/[0.06] rounded-lg p-3 cursor-pointer hover:border-white/[0.12] transition-all hover:bg-[#1a1a1a]"
    >
      {/* Top row: ID + priority + project + kebab */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[11px] text-white/30 font-mono">AGT-{task.id}</span>
        <span className={`text-[11px] ${priority.color}`}>{priority.icon}</span>
        {project && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">
            {project.emoji} {project.name}
          </span>
        )}
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/60 text-sm px-1 transition-opacity">
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id) }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className="text-[13px] text-white/90 leading-snug line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Bottom row: agent + SOP + cost */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.sopId && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-300 border-purple-500/20">
            {getSopName(task.sopId)}
          </Badge>
        )}
        {agent && (
          <span className="text-[11px] text-white/40 flex items-center gap-1">
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
          className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white"
          onClick={(e) => { e.stopPropagation() }}
        >
          ▶ Run
        </Button>
      </div>
    </div>
  )
}
