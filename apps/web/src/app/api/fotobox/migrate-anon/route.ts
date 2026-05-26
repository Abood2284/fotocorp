import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { migrateAnonBoards } from "@/lib/api/account-api"

export async function POST(request: Request) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return authRequired()

  const body = await request.json().catch(() => null) as {
    boards?: Array<{ name: string; items: string[] }>
  } | null

  if (!body?.boards?.length) {
    return Response.json(
      { ok: false, error: { code: "NO_BOARDS_PROVIDED" } },
      { status: 400, headers: jsonHeaders().headers },
    )
  }

  try {
    const appUser = await getOrCreateAppUser(authUser)
    return Response.json(
      await migrateAnonBoards({
        authUserId: appUser.authUserId,
        appUserProfileId: appUser.id,
        boards: body.boards,
      }),
      jsonHeaders(),
    )
  } catch {
    return internalError()
  }
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
