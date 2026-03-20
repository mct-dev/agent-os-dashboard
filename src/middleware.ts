import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export default auth((request) => {
  const { pathname } = request.nextUrl

  // Always allow: API routes, auth routes, static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Check for a valid session (provided by auth() wrapper)
  if (!request.auth?.user?.email) {
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
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
