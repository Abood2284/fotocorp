import type { NextRequest } from "next/server"
import { buildAuthProxyRequestHeaders } from "@/lib/api/bff-proxy-headers"
import { FOTOCORP_STAFF_SESSION_COOKIE } from "@/lib/api/staff-api"
import { buildUnifiedSessionFromPlatform, buildUnifiedSessionFromStaff } from "@/lib/auth-session-build"
import type { UnifiedAuthSession } from "@/lib/auth-session-types"
const FOTOCORP_SESSION_COOKIE = "fotocorp_session"

interface PlatformSessionResponse {
  ok?: boolean
  ownerType?: "USER" | "CONTRIBUTOR"
  user?: {
    id: string
    email: string
    displayName?: string | null
    username?: string | null
  } | null
  contributor?: {
    id: string
    displayName: string
    username: string
    email?: string | null
  } | null
}

interface StaffMeResponse {
  ok?: boolean
  staff?: {
    id: string
    username: string
    displayName: string
    role: string
  }
}

export async function GET(request: NextRequest) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return Response.json({ error: { code: "AUTH_API_NOT_CONFIGURED" } }, { status: 500 })
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  const hasStaffCookie = cookieHeader.includes(`${FOTOCORP_STAFF_SESSION_COOKIE}=`)
  const hasPlatformCookie = cookieHeader.includes(`${FOTOCORP_SESSION_COOKIE}=`)

  if (!hasStaffCookie && !hasPlatformCookie) {
    return new Response(null, { status: 401 })
  }

  const headers = buildAuthProxyRequestHeaders(request.headers)

  if (hasStaffCookie) {
    const staffSession = await fetchStaffSession(apiBaseUrl, headers)
    if (staffSession) {
      return Response.json(staffSession)
    }
  }

  if (hasPlatformCookie) {
    const platformSession = await fetchPlatformSession(apiBaseUrl, headers)
    if (platformSession) {
      return Response.json(platformSession)
    }
  }

  return new Response(null, { status: 401 })
}

async function fetchStaffSession(
  apiBaseUrl: string,
  headers: Headers,
): Promise<UnifiedAuthSession | null> {
  let response: Response
  try {
    response = await fetch(new URL("/api/v1/staff/auth/me", apiBaseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (response.status === 401) return null
  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as StaffMeResponse | null
  if (!payload?.staff?.id) return null

  return buildUnifiedSessionFromStaff({ staff: payload.staff })
}

async function fetchPlatformSession(
  apiBaseUrl: string,
  headers: Headers,
): Promise<UnifiedAuthSession | null> {
  let response: Response
  try {
    response = await fetch(new URL("/api/v1/auth/session", apiBaseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (response.status === 401) {
    return fetchPlatformSessionLegacy(apiBaseUrl, headers)
  }

  if (!response.ok) {
    return fetchPlatformSessionLegacy(apiBaseUrl, headers)
  }

  const payload = (await response.json().catch(() => null)) as PlatformSessionResponse | null
  if (!payload?.ownerType) return null

  return buildUnifiedSessionFromPlatform({
    ownerType: payload.ownerType,
    user: payload.user,
    contributor: payload.contributor,
  })
}

async function fetchPlatformSessionLegacy(
  apiBaseUrl: string,
  headers: Headers,
): Promise<UnifiedAuthSession | null> {
  const userSession = await fetchPlatformUserSession(apiBaseUrl, headers)
  if (userSession) return userSession

  let contributorResponse: Response
  try {
    contributorResponse = await fetch(new URL("/api/v1/contributor/auth/me", apiBaseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (!contributorResponse.ok) return null

  const payload = (await contributorResponse.json().catch(() => null)) as {
    contributor?: { id: string; displayName: string; email?: string | null }
    account?: { username: string }
  } | null

  if (!payload?.contributor?.id || !payload.account?.username) return null

  return buildUnifiedSessionFromPlatform({
    ownerType: "CONTRIBUTOR",
    contributor: {
      id: payload.contributor.id,
      displayName: payload.contributor.displayName,
      username: payload.account.username,
      email: payload.contributor.email ?? null,
    },
  })
}

async function fetchPlatformUserSession(
  apiBaseUrl: string,
  headers: Headers,
): Promise<UnifiedAuthSession | null> {
  let userResponse: Response
  try {
    userResponse = await fetch(new URL("/api/v1/auth/me", apiBaseUrl), {
      method: "GET",
      headers,
      cache: "no-store",
    })
  } catch {
    return null
  }

  if (userResponse.status === 401 || !userResponse.ok) return null

  const payload = (await userResponse.json().catch(() => null)) as {
    user?: { id: string; email: string; name?: string | null; username?: string | null }
  } | null

  if (!payload?.user?.id) return null

  return buildUnifiedSessionFromPlatform({
    ownerType: "USER",
    user: {
      id: payload.user.id,
      email: payload.user.email,
      displayName: payload.user.name ?? null,
      username: payload.user.username ?? null,
    },
  })
}
