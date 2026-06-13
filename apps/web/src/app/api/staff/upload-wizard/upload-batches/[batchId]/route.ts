import { InternalApiRequestError, internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

interface RouteContext {
  params: Promise<{ batchId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const { batchId } = await context.params

  try {
    const data = await internalApiJson<unknown>({
      path: internalApiRoutes.adminStaffUploadWizardUploadBatchDetail(batchId),
      method: "GET",
      headers: gate.headers,
    })
    return Response.json(data, { headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "BATCH_LOAD_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "BATCH_LOAD_FAILED", message: "Could not load upload batch." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
