import { presignStaffContributorUploadReplace } from "@/lib/api/staff-contributor-uploads-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

interface ReplacePresignContext {
  params: Promise<{ imageAssetId: string }>
}

export async function POST(request: Request, context: ReplacePresignContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/contributor-uploads")) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Your staff role cannot replace contributor uploads." } },
      { status: 403, headers: SAFE_HEADERS },
    )
  }

  const { imageAssetId } = await context.params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  if (!isPresignPayload(payload)) {
    return Response.json(
      { error: { code: "INVALID_PAYLOAD", message: "contentType is required." } },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  try {
    const result = await presignStaffContributorUploadReplace(imageAssetId, payload.contentType)
    return Response.json(result, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      const status =
        error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404
          ? error.status
          : error.status === 503
            ? 503
            : 502
      return Response.json(
        { error: { code: error.code ?? "PRESIGN_FAILED", message: error.message } },
        { status, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "PRESIGN_FAILED", message: "Could not prepare replace upload." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}

interface PresignPayload {
  contentType: string
}

function isPresignPayload(value: unknown): value is PresignPayload {
  if (!value || typeof value !== "object") return false
  const ct = (value as PresignPayload).contentType
  return typeof ct === "string" && ct.trim().length > 0 && ct.length <= 200
}
