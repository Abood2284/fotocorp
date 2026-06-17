import { InternalApiRequestError } from "@/lib/server/internal-api"
import { rejectStaffCaricature } from "@/lib/api/staff-caricatures-api"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

interface RouteContext {
  params: Promise<{ assetId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/caricatures")) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Your staff role cannot reject caricatures." } },
      { status: 403, headers: SAFE_HEADERS },
    )
  }

  const { assetId } = await context.params

  try {
    const result = await rejectStaffCaricature(assetId)
    return Response.json(result, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "REJECT_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "REJECT_FAILED", message: "Could not reject caricature." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}
