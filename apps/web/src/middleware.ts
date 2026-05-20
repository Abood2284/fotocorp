import { hasBetterAuthSessionCookie } from "@/lib/edge-better-auth-session-presence"
import {
  CONSTRUCTION_PAGE_PATH,
  getSiteUnderConstructionBypassSecret,
  hasSitePreviewBypass,
  isSiteUnderConstruction,
  SITE_PREVIEW_COOKIE,
} from "@/lib/site-under-construction"
import { NextRequest, NextResponse } from "next/server"

const STATIC_PATH_PREFIXES = ["/_next/static", "/_next/image"] as const

function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
  if (pathname === "/favicon.svg") return true
  if (pathname.startsWith("/images/")) return true
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
}

function applyPreviewBypassCookie(response: NextResponse, secret: string): NextResponse {
  response.cookies.set(SITE_PREVIEW_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}

function handleUnderConstruction(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname

  if (isStaticAssetPath(pathname)) return NextResponse.next()

  const bypassSecret = getSiteUnderConstructionBypassSecret()
  const previewQuery = request.nextUrl.searchParams.get("preview")

  if (bypassSecret && previewQuery === bypassSecret) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.searchParams.delete("preview")
    const response = NextResponse.redirect(redirectUrl)
    return applyPreviewBypassCookie(response, bypassSecret)
  }

  if (hasSitePreviewBypass(request)) return NextResponse.next()

  if (pathname.startsWith("/api/")) return NextResponse.next()

  if (pathname === CONSTRUCTION_PAGE_PATH) return NextResponse.next()

  const constructionUrl = new URL(CONSTRUCTION_PAGE_PATH, request.url)
  return NextResponse.redirect(constructionUrl)
}

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
  if (isSiteUnderConstruction()) return handleUnderConstruction(request)

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
