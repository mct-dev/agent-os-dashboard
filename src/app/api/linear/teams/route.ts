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

  const teams = await client.teams()
  const result = teams.nodes.map((t) => ({
    id: t.id,
    name: t.name,
    key: t.key,
  }))

  return NextResponse.json(result)
}
