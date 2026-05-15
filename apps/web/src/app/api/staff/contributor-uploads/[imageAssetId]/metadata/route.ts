import { internalApiFetch } from "@/lib/server/internal-api"
import { internalApiRoutes } from "@/lib/server/internal-api/routes"
import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

interface MetadataRouteContext {
  params: Promise<{ imageAssetId: string }>
}

export async function PATCH(request: Request, context: MetadataRouteContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  const { imageAssetId } = await context.params
  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/contributor-uploads")) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Your staff role cannot edit contributor uploads." } },
      { status: 403, headers: SAFE_HEADERS },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  if (!isMetadataPayload(payload)) {
    return Response.json(
      {
        error: {
          code: "INVALID_PAYLOAD",
          message: "expectedUpdatedAt and at least one of title, caption, or keywords are required.",
        },
      },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  const upstream = await internalApiFetch({
    path: internalApiRoutes.adminContributorUploadMetadata(imageAssetId),
    method: "PATCH",
    body: payload,
    headers: await getStaffInternalAdminActorHeaders(),
  })

  const headers = new Headers(SAFE_HEADERS)
  const contentType = upstream.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)

  return new Response(upstream.body, { status: upstream.status, headers })
}

interface MetadataPayload {
  expectedUpdatedAt: string
  title?: string | null
  caption?: string | null
  keywords?: string | string[] | null
}

function isMetadataPayload(value: unknown): value is MetadataPayload {
  if (!value || typeof value !== "object") return false
  const o = value as MetadataPayload
  if (typeof o.expectedUpdatedAt !== "string" || o.expectedUpdatedAt.trim().length === 0) return false
  const has =
    o.title !== undefined || o.caption !== undefined || o.keywords !== undefined
  return has
}
