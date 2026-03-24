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

  const users = await client.users({ first: 250 })
  const result = users.nodes
    .filter((u) => u.active)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      displayName: u.displayName,
    }))

  return NextResponse.json(result)
}
