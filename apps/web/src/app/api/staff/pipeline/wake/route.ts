import type { NextRequest } from "next/server"

import { getStaffInternalAdminActorHeaders, getOptionalStaffSession } from "@/lib/staff-session"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { InternalApiRequestError, internalApiJson, internalApiRoutes } from "@/lib/server/internal-api"
import type { JobsPipelineWakeResult } from "@/lib/api/staff-pipeline-types"

const SAFE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

export async function POST(_request: NextRequest) {
  const session = await getOptionalStaffSession()
  if (!session) {
    return Response.json(
      { error: { code: "STAFF_UNAUTHORIZED", message: "Staff session is required." } },
      { status: 401, headers: SAFE_HEADERS },
    )
  }

  if (!staffRoleCanAccessPath(session.staff.role, "/staff/pipeline")) {
    return Response.json(
      { error: { code: "STAFF_FORBIDDEN", message: "You do not have access to the pipeline view." } },
      { status: 403, headers: SAFE_HEADERS },
    )
  }

  try {
    const data = await internalApiJson<JobsPipelineWakeResult>({
      path: internalApiRoutes.adminJobsPipelineWake(),
      method: "POST",
      headers: await getStaffInternalAdminActorHeaders(),
      timeoutMs: 130_000,
    })
    return Response.json(data, {
      status: data.ok ? 200 : 502,
      headers: SAFE_HEADERS,
    })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "UPSTREAM_ERROR", message: "Could not wake the jobs worker." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}
