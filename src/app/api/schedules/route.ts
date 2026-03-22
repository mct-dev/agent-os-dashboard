import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

const VALID_PRESETS: SchedulePreset[] = ["once", "hourly", "daily", "weekly", "monthly"]

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobs = await prisma.scheduledJob.findMany({
    where: { userId: session.user.email },
    orderBy: { nextRunAt: "asc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  })

  return NextResponse.json(
    jobs.map((j) => ({
      ...j,
      lastRunStatus: j.runs[0]?.status ?? null,
      runs: undefined,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
  } = body

  // Validate required fields
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }
  if (!preset) {
    return NextResponse.json({ error: "preset is required" }, { status: 400 })
  }
  if (!VALID_PRESETS.includes(preset as SchedulePreset)) {
    return NextResponse.json(
      { error: `preset must be one of: ${VALID_PRESETS.join(", ")}` },
      { status: 400 }
    )
  }

  // One-time jobs: reject past dates
  if (preset === "once") {
    const at = scheduledAt ? new Date(scheduledAt) : null
    if (!at || isNaN(at.getTime())) {
      return NextResponse.json(
        { error: "scheduledAt is required for one-time jobs" },
        { status: 400 }
      )
    }
    if (at <= new Date()) {
      return NextResponse.json(
        { error: "scheduledAt must be in the future for one-time jobs" },
        { status: 400 }
      )
    }
  }

  const nextRunAt = computeNextRunAt(preset as SchedulePreset, {
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    hour: hour ?? null,
    minute: minute ?? null,
    dayOfWeek: dayOfWeek ?? null,
    dayOfMonth: dayOfMonth ?? null,
  })

  if (!nextRunAt) {
    return NextResponse.json(
      { error: "Could not compute next run time for the given preset and options" },
      { status: 400 }
    )
  }

  const job = await prisma.scheduledJob.create({
    data: {
      userId: session.user.email,
      name,
      agentConfigId: agentConfigId ?? null,
      tool: tool ?? "claude-code",
      model: model ?? "anthropic/claude-sonnet-4-6",
      prompt,
      preset,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      hour: hour ?? null,
      minute: minute ?? null,
      dayOfWeek: dayOfWeek ?? null,
      dayOfMonth: dayOfMonth ?? null,
      taskMode: taskMode ?? "create",
      taskId: taskId ?? null,
      projectId: projectId ?? null,
      nextRunAt,
    },
  })

  return NextResponse.json(job, { status: 201 })
}
