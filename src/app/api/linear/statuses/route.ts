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

  const states = await client.workflowStates({ first: 100 })
  // Deduplicate by name (states exist per-team but names repeat)
  const seen = new Set<string>()
  const result: { name: string; color: string; type: string }[] = []
  for (const s of states.nodes) {
    if (!seen.has(s.name)) {
      seen.add(s.name)
      result.push({ name: s.name, color: s.color, type: s.type })
    }
  }

  // Sort by workflow type order: backlog, unstarted, started, completed, cancelled
  const typeOrder: Record<string, number> = { backlog: 0, unstarted: 1, started: 2, completed: 3, cancelled: 4 }
  result.sort((a, b) => (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5))

  return NextResponse.json(result)
}
