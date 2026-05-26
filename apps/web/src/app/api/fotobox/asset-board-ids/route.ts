import { getCurrentAuthUser, getOrCreateAppUser } from "@/lib/app-user"
import { internalApiJson } from "@/lib/server/internal-api"
import { internalApiRoutes } from "@/lib/server/internal-api/routes"

export async function GET(request: Request) {
  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    return Response.json(
      { ok: false, error: { code: "AUTH_REQUIRED" } },
      { status: 401, headers: { "X-Content-Type-Options": "nosniff" } },
    )
  }

  const url = new URL(request.url)
  const assetId = url.searchParams.get("assetId")
  if (!assetId) {
    return Response.json(
      { ok: false, error: { code: "ASSET_ID_REQUIRED" } },
      { status: 400, headers: { "X-Content-Type-Options": "nosniff" } },
    )
  }

  try {
    const appUser = await getOrCreateAppUser(authUser)
    const params = new URLSearchParams({ authUserId: appUser.authUserId, assetId })
    return Response.json(
      await internalApiJson<{ ok: true; boardIds: string[] }>({
        path: `${internalApiRoutes.fotoboxAssetBoardIds()}?${params.toString()}`,
      }),
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    )
  } catch {
    return Response.json(
      { ok: false, error: { code: "INTERNAL_ERROR" } },
      { status: 500, headers: { "X-Content-Type-Options": "nosniff" } },
    )
  }
}
