import "server-only"

import { getOptionalStaffSession, getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"

export const STAFF_UPLOAD_WIZARD_SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

export async function requireStaffUploadWizardSession(): Promise<
  | { ok: true; headers: HeadersInit }
  | { ok: false; response: Response }
> {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
        { status: 401, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      ),
    }
  }
  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/contributor-uploads")) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "FORBIDDEN", message: "Your staff role cannot create contributor uploads." } },
        { status: 403, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      ),
    }
  }
  return { ok: true, headers: await getStaffInternalAdminActorHeaders() }
}
