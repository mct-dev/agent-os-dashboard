import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"

async function getAuthOptions() {
  const GoogleProvider = (await import("next-auth/providers/google")).default
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ],
    callbacks: {
      async signIn({ profile }: { profile?: { email?: string } }) {
        return profile?.email === "mike@laurel.ai" || profile?.email === "axis139@gmail.com"
      },
    },
  }
}

export async function GET() {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  return NextResponse.json(settings ?? { onboardingComplete: false })
}

export async function POST(req: Request) {
  const session = await getServerSession(await getAuthOptions())
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { bridgeUrl, bridgeApiKey, bridgeName, onboardingComplete } = body

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.email },
    update: {
      ...(bridgeUrl !== undefined && { bridgeUrl }),
      ...(bridgeApiKey !== undefined && { bridgeApiKey }),
      ...(bridgeName !== undefined && { bridgeName }),
      ...(onboardingComplete !== undefined && { onboardingComplete }),
    },
    create: {
      userId: session.user.email,
      bridgeUrl: bridgeUrl ?? null,
      bridgeApiKey: bridgeApiKey ?? null,
      bridgeName: bridgeName ?? null,
      onboardingComplete: onboardingComplete ?? false,
    },
  })

  return NextResponse.json(settings)
}
