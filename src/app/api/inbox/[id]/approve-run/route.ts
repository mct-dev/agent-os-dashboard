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

  // Find InboxItem and verify it is an approve_run action with a scheduledJobId
  const item = await prisma.inboxItem.findUnique({ where: { id } })
  if (!item) {
    return NextResponse.json({ error: "Inbox item not found" }, { status: 404 })
  }
  if (item.action !== "approve_run") {
    return NextResponse.json(
      { error: "Inbox item is not an approve_run action" },
      { status: 400 }
    )
  }
  if (!item.scheduledJobId) {
    return NextResponse.json(
      { error: "Inbox item has no scheduledJobId" },
      { status: 400 }
    )
  }

  // Find the ScheduledJob and verify ownership
  const job = await prisma.scheduledJob.findUnique({
    where: { id: item.scheduledJobId },
  })
  if (!job) {
    return NextResponse.json({ error: "Scheduled job not found" }, { status: 404 })
  }
  if (job.userId !== session.user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Get bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })
  if (!settings?.bridgeUrl) {
    return NextResponse.json(
      { error: "Bridge not configured. Complete onboarding first." },
      { status: 400 }
    )
  }

  const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")

  // Health check bridge with 5s timeout
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    let healthRes: Response
    try {
      healthRes = await fetch(`${bridgeUrl}/api/health`, {
        headers: { "x-api-key": settings.bridgeApiKey ?? "" },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!healthRes.ok) {
      return NextResponse.json(
        { error: "Bridge is still offline" },
        { status: 502 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "Bridge is still offline" },
      { status: 502 }
    )
  }

  // Resolve task: create new or reuse existing
  let taskId: string
  let taskTitle: string

  if (job.taskMode === "create" || !job.taskId) {
    const now = new Date()
    taskTitle = `${job.name} — ${now.toISOString()}`
    const newTask = await prisma.task.create({
      data: {
        title: taskTitle,
        status: "TODO",
        projectId: job.projectId ?? null,
      },
    })
    taskId = newTask.id
  } else {
    const existingTask = await prisma.task.findUnique({
      where: { id: job.taskId },
    })
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    taskId = existingTask.id
    taskTitle = existingTask.title
  }

  // Dispatch run to bridge
  let bridgeData: { runId?: string; id?: string }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let bridgeResponse: Response
    try {
      bridgeResponse = await fetch(`${bridgeUrl}/api/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.bridgeApiKey ?? "",
        },
        body: JSON.stringify({
          task_id: taskId,
          task_title: taskTitle,
          task_description: "",
          prompt: job.prompt,
          model: job.model,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!bridgeResponse.ok) {
      const text = await bridgeResponse.text().catch(() => "Unknown bridge error")
      return NextResponse.json(
        { error: `Bridge returned ${bridgeResponse.status}: ${text}` },
        { status: 502 }
      )
    }
    bridgeData = await bridgeResponse.json()
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Bridge connection timed out"
        : "Failed to connect to bridge"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // Create AgentRun record
  await prisma.agentRun.create({
    data: {
      taskId,
      bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
      status: "RUNNING",
      model: job.model,
      prompt: job.prompt,
      scheduledJobId: job.id,
    },
  })

  // Clear pending state and compute next run
  const now = new Date()
  const nextRunAt = computeNextRunAt(job.preset as SchedulePreset, {
    scheduledAt: job.scheduledAt,
    hour: job.hour,
    minute: job.minute,
    dayOfWeek: job.dayOfWeek,
    dayOfMonth: job.dayOfMonth,
    after: now,
  })

  await prisma.scheduledJob.update({
    where: { id: job.id },
    data: {
      pendingApproval: false,
      missedRunCount: 0,
      lastRunAt: now,
      ...(nextRunAt !== null && { nextRunAt }),
    },
  })

  // Mark InboxItem as read
  await prisma.inboxItem.update({
    where: { id },
    data: { read: true },
  })

  return NextResponse.json({ ok: true })
}
