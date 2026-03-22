import type { SchedulePreset } from "./types"

/**
 * Compute the next run time for a scheduled job.
 * All times are UTC.
 */
export function computeNextRunAt(
  preset: SchedulePreset,
  opts: {
    scheduledAt?: Date | null
    hour?: number | null
    minute?: number | null
    dayOfWeek?: number | null // 0=Sun..6=Sat
    dayOfMonth?: number | null // 1-31
    after?: Date // compute next occurrence after this time
  },
): Date | null {
  const now = opts.after ?? new Date()

  switch (preset) {
    case "once":
      return opts.scheduledAt ?? null

    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000)

    case "daily": {
      const next = new Date(now)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
      return next
    }

    case "weekly": {
      const target = opts.dayOfWeek ?? 0
      const next = new Date(now)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      const currentDay = next.getUTCDay()
      let daysAhead = target - currentDay
      if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
        daysAhead += 7
      }
      next.setUTCDate(next.getUTCDate() + daysAhead)
      return next
    }

    case "monthly": {
      const target = opts.dayOfMonth ?? 1
      const next = new Date(now)
      next.setUTCDate(target)
      next.setUTCHours(opts.hour ?? 0, opts.minute ?? 0, 0, 0)
      if (next <= now) {
        next.setUTCMonth(next.getUTCMonth() + 1)
        next.setUTCDate(target)
      }
      return next
    }

    default:
      return null
  }
}

/**
 * Expand a scheduled job into occurrence dates within a date range.
 * Used by the calendar to render job pills on the correct days.
 */
export function expandOccurrences(
  job: {
    preset: SchedulePreset
    enabled: boolean
    scheduledAt?: string | null
    hour?: number | null
    minute?: number | null
    dayOfWeek?: number | null
    dayOfMonth?: number | null
    nextRunAt: string
  },
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const dates: Date[] = []

  if (job.preset === "once") {
    const d = job.scheduledAt ? new Date(job.scheduledAt) : new Date(job.nextRunAt)
    if (d >= rangeStart && d < rangeEnd) dates.push(d)
    return dates
  }

  // For recurring: walk forward from rangeStart
  let cursor = computeNextRunAt(job.preset, {
    hour: job.hour,
    minute: job.minute,
    dayOfWeek: job.dayOfWeek,
    dayOfMonth: job.dayOfMonth,
    after: new Date(rangeStart.getTime() - 1),
  })

  const maxIterations = 366 // safety cap
  let i = 0
  while (cursor && cursor < rangeEnd && i < maxIterations) {
    if (cursor >= rangeStart) dates.push(new Date(cursor))
    cursor = computeNextRunAt(job.preset, {
      hour: job.hour,
      minute: job.minute,
      dayOfWeek: job.dayOfWeek,
      dayOfMonth: job.dayOfMonth,
      after: cursor,
    })
    i++
  }

  return dates
}

/** Day-of-week labels for display */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

/** Short day-of-week labels */
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Preset labels for display */
export const PRESET_LABELS: Record<SchedulePreset, string> = {
  once: "Once",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}
