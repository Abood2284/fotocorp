import type { NextRequest } from "next/server"

import { getStaffInternalAdminActorHeaders, getOptionalStaffSession } from "@/lib/staff-session"
import { InternalApiRequestError, internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"

interface RouteContext {
  params: Promise<{ assetId: string }>
}

const SAFE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getOptionalStaffSession()
  if (!session) {
    return Response.json(
      { error: { code: "STAFF_UNAUTHORIZED", message: "Staff session is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  const { assetId } = await context.params

  try {
    const data = await internalApiJson<unknown>({
      path: internalApiRoutes.adminAssetGeneratePreviews(assetId),
      method: "POST",
      headers: await getStaffInternalAdminActorHeaders(),
    })
    return Response.json(data, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "UPSTREAM_ERROR", message: "Could not queue preview regeneration." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}
