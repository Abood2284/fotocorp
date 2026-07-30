import { getCurrentAuthUser } from "@/lib/app-user"
import { resolveSubscriberHasCaricatureClearAccess } from "@/lib/caricatures/caricature-clear-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

export const CARICATURE_ACCESS_SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function GET() {
  const staff = await getOptionalStaffSession()
  if (staff) {
    return Response.json({ hasClearAccess: true }, { headers: CARICATURE_ACCESS_SAFE_HEADERS })
  }

  const authUser = await getCurrentAuthUser()
  if (!authUser) {
    return Response.json({ hasClearAccess: false }, { status: 401, headers: CARICATURE_ACCESS_SAFE_HEADERS })
  }

  const hasClearAccess = await resolveSubscriberHasCaricatureClearAccess(authUser.id)
  return Response.json({ hasClearAccess }, { headers: CARICATURE_ACCESS_SAFE_HEADERS })
}
