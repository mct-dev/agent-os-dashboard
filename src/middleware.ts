import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip API routes, setup page, auth routes, and static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Check if user has a session token
  const token = await getToken({ req: request })
  if (!token?.email) {
    return NextResponse.next()
  }

  // If user has session but hasn't completed onboarding, we check via cookie
  // The /setup page and completeOnboarding set this cookie
  const onboarded = request.cookies.get("onboarding-complete")?.value
  if (onboarded !== "true") {
    // First visit or not onboarded — redirect to setup
    // Setup page will check DB and skip if already complete
    const setupUrl = new URL("/setup", request.url)
    return NextResponse.redirect(setupUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
