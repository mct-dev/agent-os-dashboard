import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLinearClient } from "@/lib/linear-client"
import { serializeTask } from "@/lib/api-helpers"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { issueIds, projectId } = await req.json()

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return NextResponse.json({ error: "issueIds array required" }, { status: 400 })
  }
  if (issueIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 issues per import" }, { status: 400 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const tasks = await Promise.all(
    issueIds.map(async (issueId: string) => {
      const issue = await client.issue(issueId)
      const state = await issue.state
      const assignee = await issue.assignee
      const team = await issue.team

      const description = issue.description
        ? issue.description.slice(0, 10_000)
        : null

      const task = await prisma.task.create({
        data: {
          title: issue.title,
          description,
          projectId: projectId || null,
          status: "BACKLOG",
          priority: "MEDIUM",
          linearLinks: {
            create: {
              linearIssueId: issue.id,
              linearIssueUrl: issue.url,
              linearTeamKey: team?.key ?? "",
              linearIssueNumber: issue.number,
              linearTitle: issue.title,
              linearStatus: state?.name ?? null,
              linearPriority: issue.priority,
              linearAssignee: assignee?.name ?? null,
              syncedAt: new Date(),
            },
          },
        },
        include: { runs: true, linearLinks: true },
      })

      return serializeTask(task)
    })
  )

  return NextResponse.json(tasks)
}
