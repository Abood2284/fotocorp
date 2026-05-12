import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { addFotoboxItem, listFotoboxItems } from "@/lib/api/account-api"

export async function GET(request: Request) {
  const appUser = await getRequestAppUser()
  if (!appUser) return authRequired()

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? 24)
  const cursor = url.searchParams.get("cursor") ?? undefined

  try {
    return Response.json(
      await listFotoboxItems({ authUserId: appUser.authUserId, limit, cursor }),
      jsonHeaders(),
    )
  } catch {
    return internalError()
  }
}

export async function POST(request: Request) {
  const appUser = await getRequestAppUser()
  if (!appUser) return authRequired()

  const body = await request.json().catch(() => null) as { assetId?: string } | null
  if (!body?.assetId) {
    return Response.json(
      { ok: false, error: { code: "ASSET_NOT_FOUND" } },
      { status: 400, headers: jsonHeaders().headers },
    )
  }

  try {
    return Response.json(
      await addFotoboxItem({ authUserId: appUser.authUserId, assetId: body.assetId }),
      jsonHeaders(),
    )
  } catch {
    return Response.json(
      { ok: false, error: { code: "ASSET_NOT_SAVEABLE" } },
      { status: 409, headers: jsonHeaders().headers },
    )
  }
}

async function getRequestAppUser() {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return null
  return getOrCreateAppUser(authUser)
}

function authRequired() {
  return Response.json(
    { ok: false, error: { code: "AUTH_REQUIRED" } },
    { status: 401, headers: jsonHeaders().headers },
  )
}

function internalError() {
  return Response.json(
    { ok: false, error: { code: "INTERNAL_ERROR" } },
    { status: 500, headers: jsonHeaders().headers },
  )
}

function jsonHeaders() {
  return {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  }
}
