import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import {
  listInternalAdminEvents,
  getInternalAdminEventById,
  updateInternalAdminEvent,
  purgeInternalAdminEvent,
} from "../../../lib/events/admin-events"
import {
  getAdminEventSearchIndexStatus,
  syncAdminEventSearchIndex,
} from "../../../lib/search/typesense-event-search-index"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import type { AdminEventListFilters } from "../../../lib/events/admin-events"

interface AdminActor { authUserId: string | null; email: string | null }

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

export async function listAdminEventsService(env: Env, filters: AdminEventListFilters) {
  return json(await listInternalAdminEvents(db(env), filters))
}

export async function getAdminEventByIdService(env: Env, eventId: string) {
  const result = await getInternalAdminEventById(db(env), eventId)
  if (!result) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")
  return json(result)
}

export async function updateAdminEventService(env: Env, eventId: string, payload: any) {
  return json(await updateInternalAdminEvent(db(env), env, eventId, payload))
}

export async function purgeAdminEventService(
  env: Env,
  eventId: string,
  payload: { exactName: string; phrase: string; password: string },
  actor: AdminActor
) {
  return json(await purgeInternalAdminEvent(db(env), env, eventId, payload, actor))
}

export async function getAdminEventSearchIndexStatusService(env: Env, eventId: string) {
  const event = await getInternalAdminEventById(db(env), eventId)
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")
  return json(await getAdminEventSearchIndexStatus(db(env), env, eventId))
}

export async function syncAdminEventSearchIndexService(env: Env, eventId: string) {
  const event = await getInternalAdminEventById(db(env), eventId)
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.")
  return json(await syncAdminEventSearchIndex(db(env), env, eventId))
}

export function actorFromRequest(request: Request): AdminActor {
  return {
    authUserId: request.headers.get("x-admin-auth-user-id")?.trim() || null,
    email: request.headers.get("x-admin-email")?.trim() || null,
  }
}
