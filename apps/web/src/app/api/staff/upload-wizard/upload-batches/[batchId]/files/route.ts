import { internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

interface RouteContext {
  params: Promise<{ batchId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const { batchId } = await context.params

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
      path: internalApiRoutes.adminStaffUploadWizardUploadBatchFiles(batchId),
      method: "POST",
      body,
      headers: gate.headers,
    })
    return Response.json(data, { status: 201, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "PREPARE_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "PREPARE_FAILED", message: "Could not prepare uploads." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
