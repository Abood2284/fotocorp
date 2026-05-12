import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { listDownloadHistory } from "@/lib/api/account-api"

export async function GET(request: Request) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    return Response.json(
      { ok: false, error: { code: "AUTH_REQUIRED" } },
      { status: 401, headers: jsonHeaders().headers },
    )
  }

  const appUser = await getOrCreateAppUser(authUser)
  const url = new URL(request.url)

  try {
    return Response.json(
      await listDownloadHistory({
        authUserId: appUser.authUserId,
        year: url.searchParams.get("year") ?? undefined,
        month: url.searchParams.get("month") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 25),
      }),
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
