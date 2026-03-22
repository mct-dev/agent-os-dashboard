import type { Task as PrismaTask, AgentRun as PrismaRun, Comment as PrismaComment, LinearLink as PrismaLinearLink } from "@prisma/client"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

type TaskWithRuns = PrismaTask & { runs?: PrismaRun[]; linearLinks?: PrismaLinearLink[] }

export async function authenticate(req: NextRequest): Promise<boolean> {
  const apiKey = req.headers.get("x-api-key")
  if (apiKey && apiKey === process.env.ICARUS_API_KEY) {
    return true
  }
  const session = await auth()
  if (session?.user?.email) {
    return true
  }
  return false
}

export function serializeTask(task: TaskWithRuns) {
  return {
    ...task,
    runs: (task.runs ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      model: r.model,
      costUsd: r.costUsd,
      tokenCount: r.tokenCount,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
      bridgeRunId: r.bridgeRunId,
    })),
    linearLinks: (task.linearLinks ?? []).map((link) => ({
      id: link.id,
      taskId: link.taskId,
      linearIssueId: link.linearIssueId,
      linearIssueUrl: link.linearIssueUrl,
      linearTeamKey: link.linearTeamKey,
      linearIssueNumber: link.linearIssueNumber,
      linearTitle: link.linearTitle,
      linearStatus: link.linearStatus,
      linearPriority: link.linearPriority,
      linearAssignee: link.linearAssignee,
      syncedAt: link.syncedAt?.toISOString?.() ?? link.syncedAt,
      createdAt: link.createdAt?.toISOString?.() ?? link.createdAt,
      updatedAt: link.updatedAt?.toISOString?.() ?? link.updatedAt,
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

type CommentWithRuns = PrismaComment & { triggeredRuns?: { id: string; status: string }[] }

export function serializeComment(comment: CommentWithRuns) {
  return {
    ...comment,
    triggeredRuns: comment.triggeredRuns ?? [],
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}
