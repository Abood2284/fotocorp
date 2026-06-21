import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { invalidatePublicCaricatureFeedCache } from "../../../lib/cache/public-cache-invalidation"
import { json } from "../../../lib/http"
import {
  scheduleTypesenseDeleteForEvent,
  scheduleTypesenseSyncForAsset,
  scheduleTypesenseSyncForEvent,
} from "../../../lib/search/typesense-public-asset-sync"
import { scheduleTypesenseSyncForCaricature } from "../../../lib/search/typesense-public-caricature-sync"

function db(env: Env) {
  if (!env.DATABASE_URL) throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  return createHttpDb(env.DATABASE_URL)
}

export async function syncTypesenseAssetService(
  env: Env,
  body: { assetId: string; critical?: boolean },
) {
  await scheduleTypesenseSyncForAsset(db(env), env, body.assetId, undefined, { critical: body.critical })
  return json({ ok: true, assetId: body.assetId })
}

export async function syncTypesenseEventService(
  env: Env,
  body: { eventId: string; critical?: boolean },
) {
  await scheduleTypesenseSyncForEvent(db(env), env, body.eventId, { critical: body.critical })
  return json({ ok: true, eventId: body.eventId })
}

export async function deleteTypesenseEventService(
  env: Env,
  body: { eventId: string; critical?: boolean },
) {
  await scheduleTypesenseDeleteForEvent(env, body.eventId, { critical: body.critical })
  return json({ ok: true, eventId: body.eventId })
}

export async function syncTypesenseCaricatureService(
  env: Env,
  body: { assetId: string; critical?: boolean },
) {
  await scheduleTypesenseSyncForCaricature(db(env), env, body.assetId, { critical: body.critical })
  await invalidatePublicCaricatureFeedCache(env)
  return json({ ok: true, assetId: body.assetId })
}
