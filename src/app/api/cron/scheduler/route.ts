import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeNextRunAt } from "@/lib/schedule-utils"
import type { SchedulePreset } from "@/lib/types"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // 1. Query all due jobs
  const dueJobs = await prisma.scheduledJob.findMany({
    where: {
      nextRunAt: { lte: now },
      enabled: true,
      pendingApproval: false,
    },
  })

  // 2. Batch bridge URL lookups by userId
  const uniqueUserIds = [...new Set(dueJobs.map((j) => j.userId))]
  const settingsByUserId = new Map<
    string,
    { bridgeUrl: string | null; bridgeApiKey: string | null; defaultCwd: string | null }
  >()
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      })
      settingsByUserId.set(userId, {
        bridgeUrl: settings?.bridgeUrl ?? null,
        bridgeApiKey: settings?.bridgeApiKey ?? null,
        defaultCwd: settings?.defaultCwd ?? null,
      })
    })
  )

  // 3. Process each due job
  const results: Array<{ jobId: string; status: string; detail?: string }> = []

  for (const job of dueJobs) {
    // Duplicate prevention: skip if lastRunAt is within the last 55 seconds
    if (job.lastRunAt) {
      const secondsSinceLastRun = (now.getTime() - job.lastRunAt.getTime()) / 1000
      if (secondsSinceLastRun < 55) {
        results.push({ jobId: job.id, status: "skipped", detail: "ran recently" })
        continue
      }
    }

    const userSettings = settingsByUserId.get(job.userId)
    if (!userSettings?.bridgeUrl) {
      results.push({ jobId: job.id, status: "skipped", detail: "no bridge configured" })
      continue
    }

    const bridgeUrl = userSettings.bridgeUrl.replace(/\/+$/, "")
    const bridgeApiKey = userSettings.bridgeApiKey ?? ""

    // 4. Health check the bridge
    let bridgeOnline = false
    try {
      const healthController = new AbortController()
      const healthTimeout = setTimeout(() => healthController.abort(), 5000)
      const healthRes = await fetch(`${bridgeUrl}/api/health`, {
        signal: healthController.signal,
      })
      clearTimeout(healthTimeout)
      bridgeOnline = healthRes.ok
    } catch {
      bridgeOnline = false
    }

    if (bridgeOnline) {
      // 5a. Bridge is online — create task if needed, dispatch run, record AgentRun
      let taskId = job.taskId ?? null
      const isoNow = now.toISOString()

      if (job.taskMode === "create") {
        const taskTitle = `${job.name} — ${isoNow}`
        const newTask = await prisma.task.create({
          data: {
            title: taskTitle,
            status: "IN_PROGRESS",
            projectId: job.projectId ?? null,
          },
        })
        taskId = newTask.id
      }

      // Set task to In Progress
      if (taskId) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "IN_PROGRESS" },
        }).catch(() => {}) // ignore if task doesn't exist
      }

      // Dispatch to bridge
      let bridgeRunId: string | null = null
      try {
        const runController = new AbortController()
        const runTimeout = setTimeout(() => runController.abort(), 30000)
        const bridgeRes = await fetch(`${bridgeUrl}/api/runs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": bridgeApiKey,
          },
          body: JSON.stringify({
            task_id: taskId,
            task_title: taskId
              ? (await prisma.task.findUnique({ where: { id: taskId } }))?.title ?? job.name
              : job.name,
            task_description: "",
            prompt: job.prompt,
            model: job.model,
            callback_url: `${process.env.NEXTAUTH_URL ?? ""}/api/runs/callback`,
            callback_api_key: process.env.ICARUS_API_KEY ?? "",
            cwd: userSettings.defaultCwd || undefined,
          }),
          signal: runController.signal,
        })
        clearTimeout(runTimeout)

        if (bridgeRes.ok) {
          const bridgeData = await bridgeRes.json() as { runId?: string; id?: string }
          bridgeRunId = bridgeData.runId ?? bridgeData.id ?? null
        }
      } catch {
        // Bridge dispatch failed; still record the run attempt
      }

      // Create AgentRun record
      await prisma.agentRun.create({
        data: {
          taskId: taskId ?? undefined,
          bridgeRunId,
          status: "RUNNING",
          model: job.model,
          prompt: job.prompt,
          scheduledJobId: job.id,
        },
      })

      // Advance the schedule
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
          lastRunAt: now,
          missedRunCount: 0,
          ...(job.preset === "once"
            ? { enabled: false, nextRunAt: nextRunAt ?? now }
            : { nextRunAt: nextRunAt ?? now }),
        },
      })

      results.push({ jobId: job.id, status: "dispatched" })
    } else {
      // 5b. Bridge is offline — increment missedRunCount, create/update InboxItem
      const newMissedCount = job.missedRunCount + 1

      // Upsert InboxItem for this scheduled job
      const existingInbox = await prisma.inboxItem.findFirst({
        where: {
          scheduledJobId: job.id,
          action: "approve_run",
          repliedAt: null,
        },
        orderBy: { createdAt: "desc" },
      })

      const missQuestion = `Scheduled run missed (${newMissedCount} time${newMissedCount !== 1 ? "s" : ""}). Bridge is offline. Approve to run when bridge comes back online.`

      if (existingInbox) {
        await prisma.inboxItem.update({
          where: { id: existingInbox.id },
          data: {
            question: missQuestion,
            read: false,
          },
        })
      } else {
        await prisma.inboxItem.create({
          data: {
            scheduledJobId: job.id,
            action: "approve_run",
            agentName: job.name,
            taskTitle: "Missed scheduled run",
            question: missQuestion,
            priority: "MEDIUM",
          },
        })
      }

      // Advance nextRunAt and set pendingApproval
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
          missedRunCount: newMissedCount,
          pendingApproval: true,
          nextRunAt: nextRunAt ?? now,
        },
      })

      results.push({
        jobId: job.id,
        status: "missed",
        detail: `bridge offline, missedRunCount=${newMissedCount}`,
      })
    }
  }

  return NextResponse.json({ processed: dueJobs.length, results })
}
