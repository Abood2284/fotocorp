import { hasBetterAuthSessionCookie } from "@/lib/edge-better-auth-session-presence"
import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/staff")) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-pathname", pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (hasBetterAuthSessionCookie(request)) return NextResponse.next()

  const signInUrl = new URL("/sign-in", request.url)
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(signInUrl)
}

// Photographer portal routes (`/contributor/*`) and staff routes (`/staff/*`) use separate cookies
// (not Better Auth). Staff workspace routes require staff session in `app/(staff)/staff/(workspace)/layout.tsx`.
export const config = {
  matcher: ["/account/:path*", "/staff/:path*"],
}
