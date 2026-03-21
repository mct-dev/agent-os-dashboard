import type { Task as PrismaTask, AgentRun as PrismaRun } from "@prisma/client"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

type TaskWithRuns = PrismaTask & { runs?: PrismaRun[] }

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
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}
