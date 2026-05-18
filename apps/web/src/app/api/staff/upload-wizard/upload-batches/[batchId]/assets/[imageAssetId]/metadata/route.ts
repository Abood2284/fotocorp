import { internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

interface RouteContext {
  params: Promise<{ batchId: string; imageAssetId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const { batchId, imageAssetId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }

  try {
    const data = await internalApiJson<unknown>({
      path: internalApiRoutes.adminStaffUploadWizardUploadBatchAssetMetadata(batchId, imageAssetId),
      method: "PATCH",
      body,
      headers: gate.headers,
    })
    return Response.json(data, { headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "METADATA_FAILED", message: error.message, detail: error.detail } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "METADATA_FAILED", message: "Could not save metadata." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
