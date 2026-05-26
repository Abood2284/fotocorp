import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { listFotoboxBoards, createFotoboxBoard } from "@/lib/api/account-api"

export async function GET() {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return authRequired()

  try {
    const appUser = await getOrCreateAppUser(authUser)
    return Response.json(await listFotoboxBoards(appUser.authUserId), jsonHeaders())
  } catch {
    return internalError()
  }
}

export async function POST(request: Request) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return authRequired()

  const body = await request.json().catch(() => null) as { name?: string } | null
  if (!body?.name?.trim()) {
    return Response.json({ ok: false, error: { code: "BOARD_NAME_REQUIRED" } }, { status: 400, ...jsonHeaders() })
  }

  try {
    const appUser = await getOrCreateAppUser(authUser)
    return Response.json(
      await createFotoboxBoard({ authUserId: appUser.authUserId, name: body.name.trim() }),
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
