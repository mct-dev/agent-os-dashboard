"use client"

import { useMemo } from "react"
import { expandOccurrences, DAY_NAMES_SHORT } from "@/lib/schedule-utils"
import type { ScheduledJob } from "@/lib/types"

const JOB_COLORS = [
  "bg-indigo-500 text-white",
  "bg-green-500 text-white",
  "bg-amber-500 text-black",
  "bg-rose-500 text-white",
  "bg-cyan-500 text-black",
  "bg-purple-500 text-white",
  "bg-orange-500 text-black",
  "bg-teal-500 text-white",
]

const MAX_PILLS = 3

interface MonthViewProps {
  year: number
  month: number // 0-indexed (0=Jan, 11=Dec)
  jobs: ScheduledJob[]
  onEditJob: (job: ScheduledJob) => void
  onCreateJob: (date: Date) => void
}

function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function ScheduleCalendarMonth({
  year,
  month,
  jobs,
  onEditJob,
  onCreateJob,
}: MonthViewProps) {
  // Build the grid: all Date cells to display (including leading/trailing)
  const gridDates = useMemo<Date[]>(() => {
    const firstOfMonth = new Date(year, month, 1)
    const leadingDays = firstOfMonth.getDay() // 0=Sun

    const lastOfMonth = new Date(year, month + 1, 0)
    const totalDays = leadingDays + lastOfMonth.getDate()
    const trailingDays = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7)

    const dates: Date[] = []

    // Leading days from previous month
    for (let i = leadingDays - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      dates.push(d)
    }

    // Days of this month
    for (let d = 1; d <= lastOfMonth.getDate(); d++) {
      dates.push(new Date(year, month, d))
    }

    // Trailing days from next month
    for (let d = 1; d <= trailingDays; d++) {
      dates.push(new Date(year, month + 1, d))
    }

    return dates
  }, [year, month])

  // Build occurrence map: ISO date string -> list of { job, date }
  const occurrenceMap = useMemo<Map<string, { job: ScheduledJob; date: Date; colorClass: string }[]>>(() => {
    const map = new Map<string, { job: ScheduledJob; date: Date; colorClass: string }[]>()

    if (gridDates.length === 0) return map

    const rangeStart = gridDates[0]
    const lastDate = gridDates[gridDates.length - 1]
    // rangeEnd is exclusive: start of the day after the last cell
    const rangeEnd = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1)

    jobs.forEach((job, index) => {
      const colorClass = JOB_COLORS[index % JOB_COLORS.length]
      const occurrences = expandOccurrences(job, rangeStart, rangeEnd)

      for (const occ of occurrences) {
        // expandOccurrences returns UTC dates; use local date key matching the cell
        const key = toISODateString(new Date(occ.getFullYear(), occ.getMonth(), occ.getDate()))
        const existing = map.get(key) ?? []
        existing.push({ job, date: occ, colorClass })
        map.set(key, existing)
      }
    })

    return map
  }, [gridDates, jobs])

  const today = useMemo(() => toISODateString(new Date()), [])

  return (
    <div className="w-full">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-base-300">
        {DAY_NAMES_SHORT.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-base-content/60 py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {gridDates.map((cellDate) => {
          const isCurrentMonth = cellDate.getMonth() === month
          const dateKey = toISODateString(cellDate)
          const isToday = dateKey === today
          const entries = occurrenceMap.get(dateKey) ?? []
          const visible = entries.slice(0, MAX_PILLS)
          const overflow = entries.length - visible.length

          return (
            <div
              key={dateKey}
              className={[
                "min-h-[100px] border border-base-300 p-1 flex flex-col gap-0.5 cursor-pointer",
                isToday ? "bg-base-200" : "bg-base-100 hover:bg-base-200/50",
              ].join(" ")}
              onClick={() => onCreateJob(cellDate)}
            >
              {/* Day number */}
              <span
                className={[
                  "text-xs font-medium self-start px-1",
                  isToday
                    ? "bg-primary text-primary-content rounded-full w-5 h-5 flex items-center justify-center"
                    : isCurrentMonth
                    ? "text-base-content"
                    : "text-base-content/30",
                ].join(" ")}
              >
                {cellDate.getDate()}
              </span>

              {/* Job pills */}
              {visible.map(({ job, date, colorClass }) => (
                <button
                  key={`${job.id}-${date.toISOString()}`}
                  type="button"
                  className={[
                    "w-full text-left text-[10px] leading-none px-1 py-0.5 rounded truncate",
                    colorClass,
                    !job.enabled ? "opacity-50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditJob(job)
                  }}
                  title={job.name}
                >
                  {job.name}
                </button>
              ))}

              {/* Overflow indicator */}
              {overflow > 0 && (
                <span className="text-[10px] text-base-content/60 px-1">
                  +{overflow} more
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
