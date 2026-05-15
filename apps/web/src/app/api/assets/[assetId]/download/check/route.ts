import { NextResponse } from "next/server"
import { fetchSubscriberAssetDownloadCheck, type SubscriberDownloadSize } from "@/lib/api/subscriber-downloads-api"
import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"

interface AssetDownloadCheckRouteContext {
  params: Promise<{ assetId: string }>
}

const DOWNLOAD_SIZES = new Set<SubscriberDownloadSize>(["web", "medium", "large"])

export async function POST(request: Request, context: AssetDownloadCheckRouteContext) {
  const { assetId } = await context.params
  const jsonBody = await request.json().catch(() => null) as { size?: unknown } | null
  const rawSize = jsonBody?.size
  const size =
    typeof rawSize === "string" && DOWNLOAD_SIZES.has(rawSize as SubscriberDownloadSize)
      ? (rawSize as SubscriberDownloadSize)
      : null

  if (!size) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_DOWNLOAD_REQUEST", message: "Invalid download request." } },
      { status: 400 },
    )
  }

  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } },
      { status: 401 },
    )
  }

  let appUser: Awaited<ReturnType<typeof getOrCreateAppUser>>
  try {
    appUser = await getOrCreateAppUser(authUser)
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_LOOKUP_FAILED", message: "Profile lookup failed." } },
      { status: 500 },
    )
  }

  let upstream: Response
  try {
    upstream = await fetchSubscriberAssetDownloadCheck({
      assetId,
      authUserId: appUser.authUserId,
      size,
      userAgent: request.headers.get("user-agent"),
      requestIp: getClientIp(request),
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Download check failed." } },
      { status: 502 },
    )
  }

  if (!upstream.ok) {
    const payload = (await upstream.json().catch(() => null)) as {
      ok?: boolean
      error?: { code?: string; message?: string; detail?: unknown }
    } | null
    const code = payload?.error?.code ?? "INTERNAL_ERROR"
    const message = payload?.error?.message ?? "Download check failed."
    const detail = payload?.error?.detail
    return NextResponse.json(
      { ok: false, error: { code, message, ...(detail !== undefined ? { detail } : {}) } },
      { status: upstream.status },
    )
  }

  return NextResponse.json({ ok: true as const })
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null
  )
}
