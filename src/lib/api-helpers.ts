import type { Task as PrismaTask, AgentRun as PrismaRun } from "@prisma/client"

type TaskWithRuns = PrismaTask & { runs?: PrismaRun[] }

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
