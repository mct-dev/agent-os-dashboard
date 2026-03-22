import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const VALID_PAGES = ["/board", "/inbox", "/projects", "/sops", "/agents", "/settings"]

export default async function Home() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/api/auth/signin")
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.email },
  })

  const target = VALID_PAGES.includes(settings?.defaultPage ?? "")
    ? settings!.defaultPage
    : "/board"
  redirect(target)
}
