import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"
import { getLinearClient } from "@/lib/linear-client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const links = await prisma.linearLink.findMany({ where: { taskId: id } })

  const updated = await Promise.all(
    links.map(async (link) => {
      try {
        const issue = await client.issue(link.linearIssueId)
        const state = await issue.state
        const assignee = await issue.assignee
        return prisma.linearLink.update({
          where: { id: link.id },
          data: {
            linearTitle: issue.title,
            linearStatus: state?.name ?? null,
            linearPriority: issue.priority,
            linearAssignee: assignee?.name ?? null,
            syncedAt: new Date(),
          },
        })
      } catch {
        return link
      }
    })
  )

  return NextResponse.json(updated)
}
