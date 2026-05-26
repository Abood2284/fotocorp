import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { renameFotoboxBoard, deleteFotoboxBoard } from "@/lib/api/account-api"

interface BoardRouteContext {
  params: Promise<{ boardId: string }>
}

export async function PATCH(request: Request, context: BoardRouteContext) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return authRequired()

  const { boardId } = await context.params
  const body = await request.json().catch(() => null) as { name?: string } | null
  if (!body?.name?.trim()) {
    return Response.json({ ok: false, error: { code: "BOARD_NAME_REQUIRED" } }, { status: 400, ...jsonHeaders() })
  }

  try {
    const appUser = await getOrCreateAppUser(authUser)
    return Response.json(
      await renameFotoboxBoard({ authUserId: appUser.authUserId, boardId, name: body.name.trim() }),
      jsonHeaders(),
    )
  } catch {
    return internalError()
  }
}

export async function DELETE(_request: Request, context: BoardRouteContext) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) return authRequired()

  const { boardId } = await context.params

  try {
    const appUser = await getOrCreateAppUser(authUser)
    return Response.json(
      await deleteFotoboxBoard({ authUserId: appUser.authUserId, boardId }),
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
