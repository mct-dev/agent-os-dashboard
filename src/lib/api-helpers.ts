import type { Task as PrismaTask, AgentRun as PrismaRun, Project } from "@prisma/client"

type TaskWithRuns = PrismaTask & { runs?: PrismaRun[] }

// Map Prisma task to frontend format
export function serializeTask(task: TaskWithRuns) {
  return {
    ...task,
    projectId: task.project.toLowerCase(),
    project: undefined, // remove enum field
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

// Map frontend projectId to Prisma enum
export function parseProjectId(projectId: string): Project {
  return projectId.toUpperCase() as Project
}
