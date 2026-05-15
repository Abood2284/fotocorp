import { rejectStaffContributorUploads } from "@/lib/api/staff-contributor-uploads-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function POST(request: Request) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/contributor-uploads")) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Your staff role cannot reject contributor uploads." } },
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

  if (!isRejectPayload(payload)) {
    return Response.json(
      {
        error: {
          code: "INVALID_PAYLOAD",
          message: "imageAssetIds must be a non-empty array of UUIDs.",
        },
      },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  try {
    const result = await rejectStaffContributorUploads(payload.imageAssetIds)
    return Response.json(result, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      const status =
        error.status === 400 || error.status === 401 || error.status === 403 ? error.status : 502
      return Response.json(
        { error: { code: error.code ?? "REJECT_FAILED", message: error.message } },
        { status, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "REJECT_FAILED", message: "Could not reject uploads." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}

interface RejectPayload {
  imageAssetIds: string[]
}

function isRejectPayload(value: unknown): value is RejectPayload {
  if (!value || typeof value !== "object") return false
  const ids = (value as RejectPayload).imageAssetIds
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) return false
  return ids.every((id) => typeof id === "string" && id.length > 0)
}
