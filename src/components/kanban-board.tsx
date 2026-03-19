"use client"

import { useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useAppState } from "@/lib/store"
import { STATUS_CONFIG, STATUSES, type Status, type Task } from "@/lib/types"
import { TaskCard } from "@/components/task-card"
import { TaskPanel } from "@/components/task-panel"
import { NewTaskDialog } from "@/components/new-task-dialog"

function SortableTaskCard({
  task,
  onDelete,
}: {
  task: Task
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onDelete={onDelete} />
    </div>
  )
}

function DroppableColumn({
  status,
  tasks,
  isOver,
  onDelete,
}: {
  status: Status
  tasks: Task[]
  isOver: boolean
  onDelete: (id: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: status })
  const config = STATUS_CONFIG[status]
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] flex flex-col shrink-0 rounded-lg transition-colors ${
        isOver ? "bg-accent/50 ring-2 ring-primary/30" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {config.label}
        </span>
        <span className="text-[11px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pb-4 min-h-[40px]">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}

export function KanbanBoard() {
  const { tasks, setTasks, projects } = useAppState()
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const filteredTasks =
    projectFilter === "all"
      ? tasks
      : tasks.filter((t) => t.projectId === projectFilter)

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverColumn(null)
      return
    }
    // over.id could be a status column or a task id
    const isColumn = STATUSES.includes(over.id as Status)
    if (isColumn) {
      setOverColumn(over.id as string)
    } else {
      // Find which column the task belongs to
      const overTask = filteredTasks.find((t) => t.id === over.id)
      setOverColumn(overTask?.status ?? null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setOverColumn(null)

    if (!over) return

    const taskId = active.id as string
    let newStatus: Status | null = null

    // Determine target status
    const isColumn = STATUSES.includes(over.id as Status)
    if (isColumn) {
      newStatus = over.id as Status
    } else {
      // Dropped onto a task card — use that task's status
      const overTask = tasks.find((t) => t.id === over.id)
      newStatus = overTask?.status ?? null
    }

    if (!newStatus) return

    const draggedTask = tasks.find((t) => t.id === taskId)
    if (!draggedTask || draggedTask.status === newStatus) return

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus!, updatedAt: new Date().toISOString() }
          : t
      )
    )
  }

  const handleDelete = () => {
    if (deleteId) {
      setTasks((prev) => prev.filter((t) => t.id !== deleteId))
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-foreground">Board</h1>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-7 text-xs w-36 bg-transparent border-input">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NewTaskDialog />
      </header>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-4 h-full min-w-max">
            {STATUSES.map((status) => {
              const columnTasks = filteredTasks.filter(
                (t) => t.status === status
              )
              return (
                <DroppableColumn
                  key={status}
                  status={status}
                  tasks={columnTasks}
                  isOver={overColumn === status}
                  onDelete={setDeleteId}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="opacity-90 rotate-2 scale-105">
                <TaskCard task={activeTask} onDelete={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Panel */}
      <TaskPanel />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task and its run history will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
