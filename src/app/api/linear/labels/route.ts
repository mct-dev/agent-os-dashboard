import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLinearClient } from "@/lib/linear-client"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await getLinearClient()
  if (!client) {
    return NextResponse.json({ error: "Linear not connected" }, { status: 400 })
  }

  const labels = await client.issueLabels({ first: 100 })
  const result = labels.nodes.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  }))

  return NextResponse.json(result)
}
