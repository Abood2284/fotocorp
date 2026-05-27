import { hasBetterAuthSessionCookie } from "@/lib/edge-better-auth-session-presence"
import { NextRequest, NextResponse } from "next/server"

function handleProtectedAccountRoutes(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname

  if (!pathname.startsWith("/account")) return null

  if (hasBetterAuthSessionCookie(request)) return NextResponse.next()

  const signInUrl = new URL("/sign-in", request.url)
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(signInUrl)
}

function handleStaffPathnameHeader(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith("/staff")) return null

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export function middleware(request: NextRequest) {
  const staffResponse = handleStaffPathnameHeader(request)
  if (staffResponse) return staffResponse

  const accountResponse = handleProtectedAccountRoutes(request)
  if (accountResponse) return accountResponse

  return NextResponse.next()
}

// Photographer portal routes (`/contributor/*`) and staff routes (`/staff/*`) use separate cookies
// (not Better Auth). Staff workspace routes require staff session in `app/(staff)/staff/(workspace)/layout.tsx`.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.svg|images/).*)",
  ],
}
