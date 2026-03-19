"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { SOPS } from "@/lib/sops"

// ── Types ──────────────────────────────────────────────────────────
type Project = "LAUREL" | "PERSONAL" | "SIDE" | "LIFE"
type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED"
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "STOPPED"

interface AgentRun {
  id: string
  status: RunStatus
  model: string
  costUsd: number | null
  tokenCount: number | null
  startedAt: string
}

interface Task {
  id: string
  title: string
  description: string | null
  project: Project
  status: Status
  priority: Priority
  sopId: string | null
  createdAt: string
  updatedAt: string
  runs: AgentRun[]
}

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_TASKS: Task[] = [
  {
    id: "1",
    title: "Build Agent OS Dashboard",
    description: "Scaffold the Next.js app with task board + agent runner",
    project: "PERSONAL",
    status: "IN_PROGRESS",
    priority: "HIGH",
    sopId: "bmad-full",
    createdAt: "2026-03-19T10:00:00Z",
    updatedAt: "2026-03-19T11:00:00Z",
    runs: [
      {
        id: "r1",
        status: "RUNNING",
        model: "anthropic/claude-opus-4-6",
        costUsd: 0.42,
        tokenCount: 12400,
        startedAt: "2026-03-19T11:00:00Z",
      },
    ],
  },
  {
    id: "2",
    title: "Regression incident captainship kickoff",
    description: "Analyze top regression sources, create tracking projects",
    project: "LAUREL",
    status: "TODO",
    priority: "URGENT",
    sopId: "bmad-dev",
    createdAt: "2026-03-18T09:00:00Z",
    updatedAt: "2026-03-18T09:00:00Z",
    runs: [],
  },
  {
    id: "3",
    title: "Set up Paperclip PM2 auto-restart",
    description: "Configure PM2 with --max-memory-restart 1500M",
    project: "LAUREL",
    status: "DONE",
    priority: "MEDIUM",
    sopId: null,
    createdAt: "2026-03-17T08:00:00Z",
    updatedAt: "2026-03-17T16:00:00Z",
    runs: [
      {
        id: "r2",
        status: "COMPLETED",
        model: "anthropic/claude-sonnet-4-6",
        costUsd: 0.08,
        tokenCount: 3200,
        startedAt: "2026-03-17T15:00:00Z",
      },
    ],
  },
  {
    id: "4",
    title: "Evening CoS workflow automation",
    description: "Automate the 7:10pm check-in prompt and recap pipeline",
    project: "PERSONAL",
    status: "BACKLOG",
    priority: "MEDIUM",
    sopId: "quick-think",
    createdAt: "2026-03-19T08:00:00Z",
    updatedAt: "2026-03-19T08:00:00Z",
    runs: [],
  },
  {
    id: "5",
    title: "Gym tracker data model",
    description: "Design schema for workout logging and progression tracking",
    project: "SIDE",
    status: "BACKLOG",
    priority: "LOW",
    sopId: null,
    createdAt: "2026-03-15T12:00:00Z",
    updatedAt: "2026-03-15T12:00:00Z",
    runs: [],
  },
  {
    id: "6",
    title: "Meal prep schedule",
    description: "Plan weekly meal prep aligned with workout days",
    project: "LIFE",
    status: "TODO",
    priority: "LOW",
    sopId: null,
    createdAt: "2026-03-14T10:00:00Z",
    updatedAt: "2026-03-14T10:00:00Z",
    runs: [],
  },
]

// ── Helpers ────────────────────────────────────────────────────────
const priorityColor: Record<Priority, string> = {
  LOW: "bg-slate-500/20 text-slate-300",
  MEDIUM: "bg-blue-500/20 text-blue-300",
  HIGH: "bg-orange-500/20 text-orange-300",
  URGENT: "bg-red-500/20 text-red-300",
}

const runStatusColor: Record<RunStatus, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-300",
  RUNNING: "bg-blue-500/20 text-blue-300",
  COMPLETED: "bg-green-500/20 text-green-300",
  FAILED: "bg-red-500/20 text-red-300",
  STOPPED: "bg-slate-500/20 text-slate-300",
}

const statusLabel: Record<Status, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  BLOCKED: "Blocked",
}

const statusGroups: Status[] = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "BLOCKED"]

function getSopName(sopId: string | null): string | null {
  if (!sopId) return null
  const sop = SOPS.find((s) => s.id === sopId)
  return sop?.name ?? sopId
}

// ── Task Card ──────────────────────────────────────────────────────
function TaskCard({ task }: { task: Task }) {
  const lastRun = task.runs[0] ?? null
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-tight">
            {task.title}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0">
            ▶ Run
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {task.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={priorityColor[task.priority]}>
            {task.priority}
          </Badge>
          {task.sopId && (
            <Badge variant="outline" className="bg-purple-500/20 text-purple-300">
              {getSopName(task.sopId)}
            </Badge>
          )}
          {lastRun && (
            <>
              <Badge variant="outline" className={runStatusColor[lastRun.status]}>
                {lastRun.status}
              </Badge>
              {lastRun.costUsd !== null && (
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300">
                  ${lastRun.costUsd.toFixed(2)}
                </Badge>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Status Column ──────────────────────────────────────────────────
function StatusColumn({ status, tasks }: { status: Status; tasks: Task[] }) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {statusLabel[status]}
        </h3>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {tasks.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

// ── New Task Dialog ────────────────────────────────────────────────
function NewTaskDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          + New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input placeholder="What needs to be done?" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional details..."
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>
                  Medium
                </option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">SOP</label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">None</option>
                {SOPS.map((sop) => (
                  <option key={sop.id} value={sop.id}>
                    {sop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
const projects: Project[] = ["LAUREL", "PERSONAL", "SIDE", "LIFE"]

export default function Dashboard() {
  const [tasks] = useState<Task[]>(MOCK_TASKS)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Agent OS</h1>
            <p className="text-sm text-muted-foreground">
              Task board + AI agent pipeline runner
            </p>
          </div>
          <NewTaskDialog />
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        <Tabs defaultValue="PERSONAL" className="w-full">
          <TabsList className="mb-6">
            {projects.map((project) => {
              const count = tasks.filter((t) => t.project === project).length
              return (
                <TabsTrigger key={project} value={project} className="gap-1.5">
                  {project}
                  {count > 0 && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.project === project)
            return (
              <TabsContent key={project} value={project}>
                <ScrollArea className="h-[calc(100vh-200px)]">
                  {projectTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <p className="text-sm">No tasks yet</p>
                      <p className="text-xs mt-1">
                        Click &quot;+ New Task&quot; to create one
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {statusGroups.map((status) => {
                        const grouped = projectTasks.filter(
                          (t) => t.status === status
                        )
                        return (
                          <StatusColumn
                            key={status}
                            status={status}
                            tasks={grouped}
                          />
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
                <Separator className="mt-4" />
              </TabsContent>
            )
          })}
        </Tabs>
      </main>
    </div>
  )
}
