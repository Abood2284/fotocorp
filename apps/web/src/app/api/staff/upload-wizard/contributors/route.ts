import { internalApiJson, internalApiRoutes, withQuery, InternalApiRequestError } from "@/lib/server/internal-api"
import { requireStaffUploadWizardSession, STAFF_UPLOAD_WIZARD_SAFE_HEADERS } from "@/lib/server/staff-upload-wizard-guard"

export async function GET(request: Request) {
  const gate = await requireStaffUploadWizardSession()
  if (!gate.ok) return gate.response

  const url = new URL(request.url)
  const search = new URLSearchParams()
  const q = url.searchParams.get("q")?.trim()
  const limit = url.searchParams.get("limit")
  if (q) search.set("q", q)
  if (limit) search.set("limit", limit)

  try {
    const data = await internalApiJson<unknown>({
      path: withQuery(internalApiRoutes.adminStaffUploadWizardContributors(), search),
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
      { error: { code: "UPSTREAM_ERROR", message: "Could not load photographers." } },
      { status: 502, headers: STAFF_UPLOAD_WIZARD_SAFE_HEADERS },
    )
  }
}
