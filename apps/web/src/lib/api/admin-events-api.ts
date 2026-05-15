import "server-only"

import type {
  AdminEventListResponse,
  AdminEventDetail,
  AdminEventPurgeResult,
} from "@/features/events/admin-events-types"
import { getStaffInternalAdminActorHeaders } from "@/lib/staff-session"
import {
  InternalApiRequestError,
  internalApiJson,
  internalApiRoutes,
  withQuery,
} from "@/lib/server/internal-api"

export async function listAdminEvents(searchParams: URLSearchParams) {
  return adminJson<AdminEventListResponse>({
    path: withQuery(internalApiRoutes.adminEvents(), searchParams),
  })
}

export async function getAdminEvent(eventId: string) {
  try {
    return await adminJson<AdminEventDetail>({
      path: internalApiRoutes.adminEvent(eventId),
    })
  } catch (error) {
    if (error instanceof InternalApiRequestError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function updateAdminEvent(eventId: string, payload: any) {
  return adminJson<any>({
    path: internalApiRoutes.adminEvent(eventId),
    method: "PATCH",
    body: payload,
  })
}

export async function purgeAdminEvent(
  eventId: string,
  payload: { exactName: string; phrase: string; password: string }
) {
  return adminJson<AdminEventPurgeResult>({
    path: internalApiRoutes.adminEventPurge(eventId),
    method: "POST",
    body: payload,
  })
}

async function adminJson<T>(input: {
  path: string
  method?: "GET" | "PATCH" | "POST"
  body?: unknown
}): Promise<T> {
  return internalApiJson<T>({
    ...input,
    headers: await getStaffInternalAdminActorHeaders(),
  })
}
