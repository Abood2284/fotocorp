import type { NextRequest } from "next/server"

import { internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import { InternalApiRequestError } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

interface RouteContext {
  params: Promise<{ assetId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const { assetId } = await context.params
  const body = await request.json().catch(() => null)
  if (!body) {
    return Response.json(
      { error: { code: "INVALID_BODY", message: "Request body is required." } },
      { status: 400, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }

  try {
    const data = await internalApiJson<unknown>({
      path: internalApiRoutes.adminCaricatureOriginalComplete(assetId),
      method: "POST",
      body,
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
      { error: { code: "UPSTREAM_ERROR", message: "Could not finalize caricature upload." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
