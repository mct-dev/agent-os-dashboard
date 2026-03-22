import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

const VALID_PRESETS: SchedulePreset[] = ["once", "hourly", "daily", "weekly", "monthly"]

export async function PUT(
  req: NextRequest,
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

  const body = await req.json()
  const {
    name,
    agentConfigId,
    tool,
    model,
    prompt,
    preset,
    scheduledAt,
    hour,
    minute,
    dayOfWeek,
    dayOfMonth,
    taskMode,
    taskId,
    projectId,
    enabled,
  } = body

  // Validate preset if provided
  if (preset !== undefined && !VALID_PRESETS.includes(preset as SchedulePreset)) {
    return NextResponse.json(
      { error: `preset must be one of: ${VALID_PRESETS.join(", ")}` },
      { status: 400 }
    )
  }

  // Recompute nextRunAt using updated or existing values
  const effectivePreset = (preset ?? existing.preset) as SchedulePreset
  const effectiveScheduledAt =
    scheduledAt !== undefined
      ? scheduledAt
        ? new Date(scheduledAt)
        : null
      : existing.scheduledAt
  const effectiveHour = hour !== undefined ? hour : existing.hour
  const effectiveMinute = minute !== undefined ? minute : existing.minute
  const effectiveDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : existing.dayOfWeek
  const effectiveDayOfMonth = dayOfMonth !== undefined ? dayOfMonth : existing.dayOfMonth

  const nextRunAt = computeNextRunAt(effectivePreset, {
    scheduledAt: effectiveScheduledAt,
    hour: effectiveHour,
    minute: effectiveMinute,
    dayOfWeek: effectiveDayOfWeek,
    dayOfMonth: effectiveDayOfMonth,
  })

  if (!nextRunAt) {
    return NextResponse.json(
      { error: "Could not compute next run time for the given preset and options" },
      { status: 400 }
    )
  }

  const job = await prisma.scheduledJob.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(agentConfigId !== undefined && { agentConfigId }),
      ...(tool !== undefined && { tool }),
      ...(model !== undefined && { model }),
      ...(prompt !== undefined && { prompt }),
      ...(preset !== undefined && { preset }),
      ...(scheduledAt !== undefined && {
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      }),
      ...(hour !== undefined && { hour }),
      ...(minute !== undefined && { minute }),
      ...(dayOfWeek !== undefined && { dayOfWeek }),
      ...(dayOfMonth !== undefined && { dayOfMonth }),
      ...(taskMode !== undefined && { taskMode }),
      ...(taskId !== undefined && { taskId }),
      ...(projectId !== undefined && { projectId }),
      ...(enabled !== undefined && { enabled }),
      nextRunAt,
    },
  })

  return NextResponse.json(job)
}

export async function DELETE(
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

  // Delete related InboxItems first
  await prisma.inboxItem.deleteMany({ where: { scheduledJobId: id } })

  await prisma.scheduledJob.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
