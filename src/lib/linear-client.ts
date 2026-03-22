import { LinearClient } from "@linear/sdk"
import { prisma } from "./prisma"
import { auth } from "./auth"

export async function getLinearClient(): Promise<LinearClient | null> {
  const session = await auth()
  if (!session?.user?.email) return null

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })
  if (!settings?.linearApiKey) return null

  return new LinearClient({ apiKey: settings.linearApiKey })
}

export async function validateLinearKey(apiKey: string): Promise<{ valid: boolean; workspace?: string; email?: string }> {
  try {
    const client = new LinearClient({ apiKey })
    const viewer = await client.viewer
    const org = await client.organization
    return { valid: true, workspace: org.name, email: viewer.email }
  } catch {
    return { valid: false }
  }
}
