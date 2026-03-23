import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  return NextResponse.json(settings ?? { onboardingComplete: false })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { bridgeUrl, bridgeApiKey, bridgeName, defaultCwd, onboardingComplete, defaultPage } = body

  const VALID_PAGES = ["/board", "/inbox", "/projects", "/sops", "/agents", "/settings"]
  if (defaultPage !== undefined && !VALID_PAGES.includes(defaultPage)) {
    return NextResponse.json({ error: "Invalid defaultPage" }, { status: 400 })
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.email },
    update: {
      ...(bridgeUrl !== undefined && { bridgeUrl }),
      ...(bridgeApiKey !== undefined && { bridgeApiKey }),
      ...(bridgeName !== undefined && { bridgeName }),
      ...(defaultCwd !== undefined && { defaultCwd }),
      ...(onboardingComplete !== undefined && { onboardingComplete }),
      ...(defaultPage !== undefined && { defaultPage }),
    },
    create: {
      userId: session.user.email,
      bridgeUrl: bridgeUrl ?? null,
      bridgeApiKey: bridgeApiKey ?? null,
      bridgeName: bridgeName ?? null,
      defaultCwd: defaultCwd ?? null,
      onboardingComplete: onboardingComplete ?? false,
      defaultPage: defaultPage ?? "/board",
    },
  })

  return NextResponse.json(settings)
}
