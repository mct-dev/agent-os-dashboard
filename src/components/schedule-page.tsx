"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useAppState } from "@/lib/store"
import { ScheduleCalendarMonth } from "@/components/schedule-calendar-month"
import { ScheduleCalendarWeek } from "@/components/schedule-calendar-week"
import { ScheduleJobModal } from "@/components/schedule-job-modal"
import type { ScheduledJob } from "@/lib/types"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatMonthTitle(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

function formatWeekTitle(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const startMonth = MONTH_NAMES_SHORT[weekStart.getMonth()]
  const endMonth = MONTH_NAMES_SHORT[weekEnd.getMonth()]
  const startDay = weekStart.getDate()
  const endDay = weekEnd.getDate()
  const endYear = weekEnd.getFullYear()

  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${startMonth} ${startDay} – ${endDay}, ${endYear}`
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`
}

export function SchedulePage() {
  const { scheduledJobs } = useAppState()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week">("month")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)
  const [createDate, setCreateDate] = useState<Date | null>(null)

  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [currentDate])

  const title = view === "month" ? formatMonthTitle(currentDate) : formatWeekTitle(weekStart)

  function handlePrev() {
    if (view === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else {
      setCurrentDate((d) => {
        const next = new Date(d)
        next.setDate(d.getDate() - 7)
        return next
      })
    }
  }

  function handleNext() {
    if (view === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else {
      setCurrentDate((d) => {
        const next = new Date(d)
        next.setDate(d.getDate() + 7)
        return next
      })
    }
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  const handleEditJob = (job: ScheduledJob) => {
    setEditingJob(job)
    setCreateDate(null)
    setModalOpen(true)
  }

  const handleCreateJob = (date: Date) => {
    setEditingJob(null)
    setCreateDate(date)
    setModalOpen(true)
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {/* Left: title + navigation */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-base-content min-w-[180px]">{title}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handlePrev}
            aria-label="Previous"
          >
            &lt;
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleNext}
            aria-label="Next"
          >
            &gt;
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleToday}
          >
            Today
          </Button>
        </div>

        {/* Right: view toggle + new job */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              className={["h-8 text-xs", view === "month" ? "btn-primary" : ""].join(" ")}
              variant={view === "month" ? "default" : "ghost"}
              onClick={() => setView("month")}
            >
              Month
            </Button>
            <Button
              size="sm"
              className={["h-8 text-xs", view === "week" ? "btn-primary" : ""].join(" ")}
              variant={view === "week" ? "default" : "ghost"}
              onClick={() => setView("week")}
            >
              Week
            </Button>
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs btn-primary"
            onClick={() => {
              setEditingJob(null)
              setCreateDate(null)
              setModalOpen(true)
            }}
          >
            + New Job
          </Button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-auto">
        {scheduledJobs.length === 0 && (
          <div className="flex items-center justify-center h-full text-base-content/50 text-sm">
            No scheduled jobs yet. Click &apos;+ New Job&apos; to create one.
          </div>
        )}
        {scheduledJobs.length > 0 && view === "month" ? (
          <ScheduleCalendarMonth
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            jobs={scheduledJobs}
            onEditJob={handleEditJob}
            onCreateJob={handleCreateJob}
          />
        ) : scheduledJobs.length > 0 ? (
          <ScheduleCalendarWeek
            weekStart={weekStart}
            jobs={scheduledJobs}
            onEditJob={handleEditJob}
            onCreateJob={handleCreateJob}
          />
        ) : null}
      </div>

      {/* Modal */}
      <ScheduleJobModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) {
            setEditingJob(null)
            setCreateDate(null)
          }
        }}
        editJob={editingJob}
        defaultDate={createDate}
      />
    </div>
  )
}
