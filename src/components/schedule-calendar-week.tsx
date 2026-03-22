"use client"

import { Fragment, useMemo } from "react"
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

/** First visible hour (6 AM) */
const HOUR_START = 6
/** Last visible hour, inclusive (11 PM = 23) */
const HOUR_END = 23
/** Total rows in the time grid */
const TOTAL_HOURS = HOUR_END - HOUR_START + 1
/** Height of one hour slot in pixels, must match h-12 (48px) */
const SLOT_HEIGHT_PX = 48

interface WeekViewProps {
  weekStart: Date // Sunday of the week
  jobs: ScheduledJob[]
  onEditJob: (job: ScheduledJob) => void
  onCreateJob: (date: Date) => void
}

/** Format an hour (0-23) as "6 AM", "12 PM", etc. */
function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

/** Return local ISO date string for comparison */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * For hourly jobs, generate one occurrence per visible hour for the given day.
 * Returns an array of Date objects each set to that day + hour.
 */
function buildHourlyOccurrencesForDay(job: ScheduledJob, day: Date): Date[] {
  const results: Date[] = []
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const d = new Date(day)
    d.setHours(h, job.minute ?? 0, 0, 0)
    results.push(d)
  }
  return results
}

interface OccurrenceEntry {
  job: ScheduledJob
  date: Date
  colorClass: string
}

export function ScheduleCalendarWeek({ weekStart, jobs, onEditJob, onCreateJob }: WeekViewProps) {
  /** The 7 day columns for this week */
  const weekDays = useMemo<Date[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  /**
   * Map from "YYYY-MM-DD:HH" -> list of occurrences to render in that slot.
   * For hourly jobs we synthesise one block per visible hour for each day they
   * otherwise appear in the week range.
   */
  const slotMap = useMemo<Map<string, OccurrenceEntry[]>>(() => {
    const map = new Map<string, OccurrenceEntry[]>()

    if (weekDays.length === 0) return map

    const rangeStart = weekDays[0]
    // rangeEnd is exclusive: start of the day after the last column
    const lastDay = weekDays[6]
    const rangeEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1)

    jobs.forEach((job, index) => {
      const colorClass = JOB_COLORS[index % JOB_COLORS.length]

      if (job.preset === "hourly") {
        // For hourly jobs: find which days in the week the job is active, then
        // place a block for every visible hour on those days.
        // A simple heuristic: show hourly blocks on every day of the week.
        weekDays.forEach((day) => {
          buildHourlyOccurrencesForDay(job, day).forEach((occ) => {
            const key = `${toLocalDateString(occ)}:${String(occ.getHours()).padStart(2, "0")}`
            const existing = map.get(key) ?? []
            existing.push({ job, date: occ, colorClass })
            map.set(key, existing)
          })
        })
        return
      }

      const occurrences = expandOccurrences(job, rangeStart, rangeEnd)
      for (const occ of occurrences) {
        const hour = occ.getHours()
        // Only render if within visible hour range
        if (hour < HOUR_START || hour > HOUR_END) continue
        const key = `${toLocalDateString(occ)}:${String(hour).padStart(2, "0")}`
        const existing = map.get(key) ?? []
        existing.push({ job, date: occ, colorClass })
        map.set(key, existing)
      }
    })

    return map
  }, [weekDays, jobs])

  const todayStr = useMemo(() => toLocalDateString(new Date()), [])
  const nowHour = new Date().getHours()
  const nowMinute = new Date().getMinutes()

  /** Hour rows from HOUR_START to HOUR_END */
  const hourRows = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i),
    [],
  )

  return (
    <div className="w-full overflow-auto">
      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-8 border-b border-base-300 sticky top-0 bg-base-100 z-10">
        {/* Time label column header */}
        <div className="w-16" />

        {weekDays.map((day) => {
          const dayStr = toLocalDateString(day)
          const isToday = dayStr === todayStr
          const label = `${DAY_NAMES_SHORT[day.getDay()]} ${day.getMonth() + 1}/${day.getDate()}`

          return (
            <div
              key={dayStr}
              className={[
                "text-center text-xs font-medium py-2",
                isToday ? "text-primary font-semibold" : "text-base-content/60",
              ].join(" ")}
            >
              {label}
            </div>
          )
        })}
      </div>

      {/* ── Time grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-8">
        {hourRows.map((hour) => {
          const hourStr = String(hour).padStart(2, "0")

          return (
            <Fragment key={hour}>
              {/* Time label */}
              <div
                className="w-16 text-right text-xs text-base-content/60 pr-2 h-12 border-b border-base-300 flex items-start pt-1 shrink-0"
              >
                {formatHour(hour)}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dayStr = toLocalDateString(day)
                const isToday = dayStr === todayStr
                const key = `${dayStr}:${hourStr}`
                const entries = slotMap.get(key) ?? []

                // Current-time indicator: visible in today's column at the
                // appropriate hour row
                const showNowLine =
                  isToday && hour === nowHour && nowHour >= HOUR_START && nowHour <= HOUR_END

                // Create date for click handler: this day at this hour
                const slotDate = new Date(day)
                slotDate.setHours(hour, 0, 0, 0)

                return (
                  <div
                    key={`${dayStr}-${hour}`}
                    className={[
                      "relative h-12 border-b border-base-300 cursor-pointer",
                      isToday ? "bg-primary/5" : "hover:bg-base-200/40",
                    ].join(" ")}
                    onClick={() => onCreateJob(slotDate)}
                  >
                    {/* Current time indicator */}
                    {showNowLine && (
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
                        style={{ top: `${(nowMinute / 60) * SLOT_HEIGHT_PX}px` }}
                      />
                    )}

                    {/* Job blocks */}
                    {entries.map(({ job, date, colorClass }, idx) => {
                      const minute = date.getMinutes()
                      const topPx = (minute / 60) * SLOT_HEIGHT_PX
                      // Stack multiple blocks horizontally if they overlap
                      const total = entries.length
                      const widthPct = total > 1 ? Math.floor(100 / total) : 100
                      const leftPct = idx * widthPct

                      return (
                        <button
                          key={`${job.id}-${date.toISOString()}`}
                          type="button"
                          className={[
                            "absolute text-[10px] leading-none px-1 py-0.5 rounded truncate z-20",
                            colorClass,
                            !job.enabled ? "opacity-50" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            top: `${topPx}px`,
                            height: `${SLOT_HEIGHT_PX - 2}px`,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={job.name}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditJob(job)
                          }}
                        >
                          {job.lastRunStatus === "COMPLETED" && job.lastRunAt && new Date(job.lastRunAt).toDateString() === date.toDateString() && (
                            <span className="mr-0.5">&#10003;</span>
                          )}
                          {job.name}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
