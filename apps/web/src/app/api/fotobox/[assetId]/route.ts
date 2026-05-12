import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { removeFotoboxItem } from "@/lib/api/account-api"

interface FotoboxItemRouteContext {
  params: Promise<{ assetId: string }>
}

export async function DELETE(_request: Request, context: FotoboxItemRouteContext) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    return Response.json(
      { ok: false, error: { code: "AUTH_REQUIRED" } },
      { status: 401, headers: jsonHeaders().headers },
    )
  }

  const appUser = await getOrCreateAppUser(authUser)
  const { assetId } = await context.params

  try {
    return Response.json(
      await removeFotoboxItem({ authUserId: appUser.authUserId, assetId }),
      jsonHeaders(),
    )
  } catch {
    return Response.json(
      { ok: false, error: { code: "INTERNAL_ERROR" } },
      { status: 500, headers: jsonHeaders().headers },
    )
  }
}

function jsonHeaders() {
  return {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  }
}
