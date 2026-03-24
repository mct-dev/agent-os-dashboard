import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLinearClient } from "@/lib/linear-client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const q = req.nextUrl.searchParams.get("q") || ""
  const teamIds = req.nextUrl.searchParams.get("teamIds")?.split(",").filter(Boolean)
  const assigneeId = req.nextUrl.searchParams.get("assigneeId")
  const labelIds = req.nextUrl.searchParams.get("labelIds")?.split(",").filter(Boolean)
  const statusNames = req.nextUrl.searchParams.get("statusNames")?.split(",").filter(Boolean)

  const filter: Record<string, unknown> = {}
  if (teamIds?.length === 1) filter.team = { id: { eq: teamIds[0] } }
  else if (teamIds && teamIds.length > 1) filter.team = { id: { in: teamIds } }
  if (assigneeId) filter.assignee = { id: { eq: assigneeId } }
  if (labelIds?.length === 1) filter.labels = { some: { id: { eq: labelIds[0] } } }
  else if (labelIds && labelIds.length > 1) filter.labels = { some: { id: { in: labelIds } } }
  if (statusNames?.length === 1) filter.state = { name: { eq: statusNames[0] } }
  else if (statusNames && statusNames.length > 1) filter.state = { name: { in: statusNames } }

  let issues
  if (q.trim()) {
    issues = await client.issueSearch({ query: q, filter, first: 50 })
  } else {
    issues = await client.issues({ filter, first: 50 })
  }

  const results = await Promise.all(
    issues.nodes.map(async (issue) => {
      const state = await issue.state
      const assignee = await issue.assignee
      const team = await issue.team
      const labels = await issue.labels()
      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,
        status: state?.name ?? "Unknown",
        priority: issue.priority,
        assignee: assignee?.name ?? null,
        team: { key: team?.key ?? "" },
        number: issue.number,
        labels: labels.nodes.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      }
    })
  )

  return NextResponse.json(results)
}
