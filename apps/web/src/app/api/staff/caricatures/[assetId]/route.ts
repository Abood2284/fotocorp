import type { NextRequest } from "next/server"

import { InternalApiRequestError } from "@/lib/server/internal-api"
import {
  deleteStaffCaricature,
  getStaffCaricatureDetail,
  updateStaffCaricature,
} from "@/lib/api/staff-caricatures-api"
import type { CaricatureAssetMetadataPayload } from "@/lib/caricatures/caricature-upload-metadata"
import { staffRoleCanAccessPath } from "@/lib/staff/staff-route-access"
import { getOptionalStaffSession } from "@/lib/staff-session"

const SAFE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const

interface RouteContext {
  params: Promise<{ assetId: string }>
}

function unauthorized() {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
    { status: 401, headers: SAFE_HEADERS },
  )
}

function forbidden(message: string) {
  return Response.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403, headers: SAFE_HEADERS },
  )
}

async function requireCaricatureStaffSession() {
  const staffSession = await getOptionalStaffSession()
  if (!staffSession) return { ok: false as const, response: unauthorized() }
  if (!staffRoleCanAccessPath(staffSession.staff.role, "/staff/caricatures")) {
    return {
      ok: false as const,
      response: forbidden("Your staff role cannot manage caricatures."),
    }
  }
  return { ok: true as const, staffSession }
}

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireCaricatureStaffSession()
  if (!gate.ok) return gate.response

  const { assetId } = await context.params

  try {
    const detail = await getStaffCaricatureDetail(assetId)
    return Response.json(detail, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "FETCH_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "FETCH_FAILED", message: "Could not load caricature detail." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireCaricatureStaffSession()
  if (!gate.ok) return gate.response

  const { assetId } = await context.params
  const body = (await request.json().catch(() => null)) as CaricatureAssetMetadataPayload | null
  if (!body) {
    return Response.json(
      { error: { code: "INVALID_BODY", message: "Request body is required." } },
      { status: 400, headers: SAFE_HEADERS },
    )
  }

  try {
    const detail = await updateStaffCaricature(assetId, body)
    return Response.json(detail, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "UPDATE_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "UPDATE_FAILED", message: "Could not update caricature." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireCaricatureStaffSession()
  if (!gate.ok) return gate.response

  const { assetId } = await context.params

  try {
    const result = await deleteStaffCaricature(assetId)
    return Response.json(result, { headers: SAFE_HEADERS })
  } catch (error) {
    if (error instanceof InternalApiRequestError) {
      return Response.json(
        { error: { code: error.code ?? "DELETE_FAILED", message: error.message } },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502, headers: SAFE_HEADERS },
      )
    }
    return Response.json(
      { error: { code: "DELETE_FAILED", message: "Could not delete caricature." } },
      { status: 502, headers: SAFE_HEADERS },
    )
  }
}
