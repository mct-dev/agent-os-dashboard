import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow: API routes, auth routes, static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Check for a valid session token
  const token = await getToken({ req: request })

  // Not signed in — redirect to sign-in page
  if (!token?.email) {
    const signInUrl = new URL("/api/auth/signin", request.url)
    signInUrl.searchParams.set("callbackUrl", request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Signed in but not yet onboarded — redirect to setup
  // (except if already on /setup to avoid redirect loop)
  if (pathname !== "/setup") {
    const onboarded = request.cookies.get("onboarding-complete")?.value
    if (onboarded !== "true") {
      const setupUrl = new URL("/setup", request.url)
      return NextResponse.redirect(setupUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
