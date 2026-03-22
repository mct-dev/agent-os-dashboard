import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.scheduledJob.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }
  if (existing.userId !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const newEnabled = !existing.enabled

  let nextRunAt = existing.nextRunAt

  if (newEnabled) {
    // Re-enabling: recompute nextRunAt from now
    const recomputed = computeNextRunAt(existing.preset as SchedulePreset, {
      scheduledAt: existing.scheduledAt,
      hour: existing.hour,
      minute: existing.minute,
      dayOfWeek: existing.dayOfWeek,
      dayOfMonth: existing.dayOfMonth,
    })
    if (recomputed) {
      nextRunAt = recomputed
    }
  }

  const job = await prisma.scheduledJob.update({
    where: { id },
    data: {
      enabled: newEnabled,
      nextRunAt,
      ...(newEnabled && {
        pendingApproval: false,
        missedRunCount: 0,
      }),
    },
  })

  return NextResponse.json(job)
}
