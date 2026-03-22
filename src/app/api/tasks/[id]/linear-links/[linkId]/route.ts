import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticate } from "@/lib/api-helpers"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id, linkId } = await params

  await prisma.linearLink.deleteMany({
    where: { id: linkId, taskId: id },
  })

  return NextResponse.json({ ok: true })
}
