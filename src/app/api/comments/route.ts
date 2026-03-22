import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate, serializeComment } from "@/lib/api-helpers"
import { auth } from "@/lib/auth"

/**
 * Parse @mentions from comment body and trigger agent runs for matched agents.
 * Runs asynchronously -- caller should fire-and-forget with .catch(console.error).
 */
async function parseMentionsAndTrigger(
  commentId: string,
  body: string,
  parentFilter: { taskId?: string; projectId?: string; agentRunId?: string }
) {
  // 1. Extract @mention tokens
  const mentionRegex = /\B@([^\s@,!?.]+)/g
  const tokens: string[] = []
  let match: RegExpExecArray | null
  while ((match = mentionRegex.exec(body)) !== null) {
    tokens.push(match[1].toLowerCase())
  }
  if (tokens.length === 0) return

  // 2. Match tokens against agent configs (case-insensitive)
  const allAgents = await prisma.agentConfig.findMany()
  const matchedAgents = allAgents.filter((agent) =>
    tokens.includes(agent.name.toLowerCase())
  )
  if (matchedAgents.length === 0) return

  // 3. Get bridge settings
  const settings = await prisma.userSettings.findFirst()
  if (!settings?.bridgeUrl) {
    console.error("parseMentionsAndTrigger: No bridge URL configured")
    return
  }

  // 4. Build thread context (all comments for the same parent)
  const whereClause: Record<string, string> = {}
  if (parentFilter.taskId) whereClause.taskId = parentFilter.taskId
  else if (parentFilter.projectId) whereClause.projectId = parentFilter.projectId
  else if (parentFilter.agentRunId)
    whereClause.agentRunId = parentFilter.agentRunId

  const threadComments = await prisma.comment.findMany({
    where: whereClause,
    orderBy: { createdAt: "asc" },
  })

  const threadContext = threadComments
    .map((c) => {
      const author = c.userId ?? c.agentId ?? "unknown"
      return `[${author}]: ${c.body}`
    })
    .join("\n")

  // 5. Get parent context (task title/description or project name)
  let parentContext = ""
  if (parentFilter.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: parentFilter.taskId },
    })
    if (task) {
      parentContext = `Task: ${task.title}${task.description ? `\nDescription: ${task.description}` : ""}`
    }
  } else if (parentFilter.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: parentFilter.projectId },
    })
    if (project) {
      parentContext = `Project: ${project.name}`
    }
  }

  // 6. Dispatch a bridge run for each matched agent
  const bridgeUrl = settings.bridgeUrl.replace(/\/+$/, "")
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/runs/callback/complete`
  const callbackApiKey = process.env.ICARUS_API_KEY ?? ""

  for (const agent of matchedAgents) {
    const prompt = [
      agent.systemPrompt ? `System: ${agent.systemPrompt}` : "",
      parentContext ? `Context:\n${parentContext}` : "",
      threadContext ? `Thread:\n${threadContext}` : "",
      `Triggering comment: ${body}`,
    ]
      .filter(Boolean)
      .join("\n\n")

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(`${bridgeUrl}/api/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.bridgeApiKey ?? "",
        },
        body: JSON.stringify({
          task_id: parentFilter.taskId ?? undefined,
          task_title: parentContext.split("\n")[0] ?? "",
          prompt,
          model: agent.model,
          callback_url: callbackUrl,
          callback_api_key: callbackApiKey,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const text = await response.text().catch(() => "Unknown bridge error")
        console.error(
          `Bridge returned ${response.status} for agent ${agent.name}: ${text}`
        )
        continue
      }

      const bridgeData = await response.json()

      // Create AgentRun in dashboard DB
      await prisma.agentRun.create({
        data: {
          taskId: parentFilter.taskId ?? null,
          bridgeRunId: bridgeData.runId ?? bridgeData.id ?? null,
          status: "RUNNING",
          model: agent.model,
          prompt,
          triggerCommentId: commentId,
          agentConfigId: agent.id,
        },
      })
    } catch (err) {
      console.error(`Failed to dispatch run for agent ${agent.name}:`, err)
    }
  }
}

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const taskId = req.nextUrl.searchParams.get("taskId")
  const projectId = req.nextUrl.searchParams.get("projectId")
  const agentRunId = req.nextUrl.searchParams.get("agentRunId")

  if (!taskId && !projectId && !agentRunId) {
    return NextResponse.json(
      { error: "One of taskId, projectId, or agentRunId is required" },
      { status: 400 }
    )
  }

  const where: Record<string, string> = {}
  if (taskId) where.taskId = taskId
  else if (projectId) where.projectId = projectId
  else if (agentRunId) where.agentRunId = agentRunId

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  return NextResponse.json(comments.map(serializeComment))
}

export async function POST(req: NextRequest) {
  // Check auth -- need to identify the author
  const apiKey = req.headers.get("x-api-key")
  const isApiKeyAuth = apiKey !== null && apiKey === process.env.ICARUS_API_KEY
  const session = await auth()
  const isSessionAuth = !!session?.user?.email

  if (!isApiKeyAuth && !isSessionAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()

  // Validate body text
  if (!body.body?.trim()) {
    return NextResponse.json(
      { error: "body is required" },
      { status: 400 }
    )
  }

  // Validate exactly one parent ID
  const parentIds = [body.taskId, body.projectId, body.agentRunId].filter(
    Boolean
  )
  if (parentIds.length !== 1) {
    return NextResponse.json(
      { error: "Exactly one of taskId, projectId, or agentRunId is required" },
      { status: 400 }
    )
  }

  // Determine author
  let userId: string | null = null
  let agentId: string | null = null

  if (isSessionAuth) {
    userId = session!.user!.email!
  } else if (isApiKeyAuth && body.agentId) {
    agentId = body.agentId
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body,
      taskId: body.taskId ?? null,
      projectId: body.projectId ?? null,
      agentRunId: body.agentRunId ?? null,
      userId,
      agentId,
    },
    include: { triggeredRuns: { select: { id: true, status: true } } },
  })

  // Fire-and-forget: parse @mentions and trigger agent runs
  const parentFilter: { taskId?: string; projectId?: string; agentRunId?: string } = {}
  if (body.taskId) parentFilter.taskId = body.taskId
  if (body.projectId) parentFilter.projectId = body.projectId
  if (body.agentRunId) parentFilter.agentRunId = body.agentRunId

  parseMentionsAndTrigger(comment.id, body.body, parentFilter).catch(
    console.error
  )

  return NextResponse.json(serializeComment(comment), { status: 201 })
}
