import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

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

  // Inject Linear ticket context into prompt
  let enrichedPrompt = prompt
  try {
    const linearLinks = await prisma.linearLink.findMany({
      where: { taskId },
    })
    if (linearLinks.length > 0) {
      const ticketLines = linearLinks
        .map(
          (link) =>
            `- ${link.linearTeamKey}-${link.linearIssueNumber}: "${link.linearTitle}" (${link.linearStatus ?? "Unknown"}) — ${link.linearIssueUrl}`
        )
        .join("\n")
      enrichedPrompt = `${prompt}\n\n---\nLINKED LINEAR TICKETS:\n${ticketLines}\n\nThese Linear tickets are linked to this task. Refer to them for additional context.\nIf you have access to Linear via MCP, you can query them for real-time details.\n---`
    }
  } catch (e) {
    console.warn("Failed to fetch linear links for context injection:", e)
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
        prompt: enrichedPrompt,
        model,
        cwd: settings.defaultCwd || undefined,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Bridge connection timed out"
        : "Failed to connect to bridge"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  if (!bridgeResponse.ok) {
    const text = await bridgeResponse.text().catch(() => "Unknown bridge error")
    return NextResponse.json(
      { error: `Bridge returned ${bridgeResponse.status}: ${text}` },
      { status: 502 }
    )
  }

  const bridgeData = await bridgeResponse.json()

  // Create AgentRun record in Supabase
  const run = await prisma.agentRun.create({
    data: {
      taskId,
      bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
      status: "RUNNING",
      model: model ?? "anthropic/claude-opus-4-6",
      prompt: prompt ?? null,
    },
  })

  return NextResponse.json(
    {
      id: run.id,
      taskId: run.taskId,
      bridgeRunId: run.bridgeRunId,
      status: run.status,
      model: run.model,
      startedAt: run.startedAt.toISOString(),
    },
    { status: 201 }
  )
}
