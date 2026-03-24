import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { buildAgentSystemPrompt } from "@/lib/agent-system-prompt"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { taskId, model, prompt } = body

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 })
  }

  // Verify the task exists
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  // Get user's bridge settings
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  if (!settings?.bridgeUrl) {
    return NextResponse.json(
      { error: "Bridge not configured. Complete onboarding first." },
      { status: 400 }
    )
  }

  // Fetch context for system prompt
  const [previousRuns, recentComments, project, linearLinks] = await Promise.all([
    prisma.agentRun.findMany({
      where: { taskId },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: { model: true, status: true, startedAt: true, prompt: true },
    }),
    prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { body: true, createdAt: true, agentId: true, userId: true },
    }),
    task.projectId
      ? prisma.project.findUnique({ where: { id: task.projectId }, select: { name: true } })
      : null,
    prisma.linearLink.findMany({ where: { taskId } }),
  ])

  // Create AgentRun record first (need the ID for system prompt)
  const run = await prisma.agentRun.create({
    data: {
      taskId,
      status: "PENDING",
      model: model ?? "anthropic/claude-opus-4-6",
      prompt: prompt ?? null,
    },
  })

  // Check if this is a session resume (bridge tracks sessions per task)
  const isResume = previousRuns.length > 0

  // Build system prompt with full context
  const dashboardUrl = process.env.NEXTAUTH_URL ?? ""
  const apiKey = process.env.ICARUS_API_KEY ?? ""
  const systemPrompt = buildAgentSystemPrompt({
    dashboardUrl,
    apiKey,
    taskId,
    taskTitle: task.title,
    taskDescription: task.description,
    agentRunId: run.id,
    projectName: project?.name ?? null,
    status: task.status,
    priority: task.priority,
    linearLinks: linearLinks.map((l) => ({
      teamKey: l.linearTeamKey,
      issueNumber: l.linearIssueNumber,
      title: l.linearTitle,
      status: l.linearStatus,
      url: l.linearIssueUrl,
    })),
    previousRuns: previousRuns.map((r) => ({
      model: r.model,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      prompt: r.prompt,
    })),
    recentComments: recentComments.reverse().map((c) => ({
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      isAgent: !!c.agentId,
    })),
    isResume,
  })

  // Dispatch run to the user's bridge
  const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")
  let bridgeResponse: Response
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    bridgeResponse = await fetch(`${bridgeUrl}/api/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.bridgeApiKey ?? "",
      },
      body: JSON.stringify({
        task_id: taskId,
        task_title: task.title,
        task_description: task.description ?? "",
        sop_id: task.sopId ?? "",
        prompt,
        model,
        cwd: settings.defaultCwd || undefined,
        system_prompt: systemPrompt,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch (err: unknown) {
    // Mark run as failed
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", endedAt: new Date() } })
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Bridge connection timed out"
        : "Failed to connect to bridge"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  if (!bridgeResponse.ok) {
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", endedAt: new Date() } })
    const text = await bridgeResponse.text().catch(() => "Unknown bridge error")
    return NextResponse.json(
      { error: `Bridge returned ${bridgeResponse.status}: ${text}` },
      { status: 502 }
    )
  }

  const bridgeData = await bridgeResponse.json()

  // Update run with bridge ID and mark as running
  const updatedRun = await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
      status: "RUNNING",
    },
  })

  return NextResponse.json(
    {
      id: updatedRun.id,
      taskId: updatedRun.taskId,
      bridgeRunId: updatedRun.bridgeRunId,
      status: updatedRun.status,
      model: updatedRun.model,
      startedAt: updatedRun.startedAt.toISOString(),
    },
    { status: 201 }
  )
}
