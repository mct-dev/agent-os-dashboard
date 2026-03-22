import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"
import { getLinearClient } from "@/lib/linear-client"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const links = await prisma.linearLink.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(links)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const { linearIssueId } = await req.json()

  if (!linearIssueId) {
    return NextResponse.json({ error: "linearIssueId required" }, { status: 400 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const issue = await client.issue(linearIssueId)
  const state = await issue.state
  const assignee = await issue.assignee
  const team = await issue.team

  const link = await prisma.linearLink.create({
    data: {
      taskId: id,
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
  })

  return NextResponse.json(link, { status: 201 })
}
