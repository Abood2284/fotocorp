import { internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

export async function GET() {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  try {
    const data = await internalApiJson<unknown>({
      path: internalApiRoutes.adminCaricatureCategories(),
      headers: gate.headers,
    })
    return Response.json(data, { headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "UPSTREAM_ERROR", message: "Could not load caricature categories." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
