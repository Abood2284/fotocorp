import { sql, type SQL } from "drizzle-orm"
import type pg from "pg"
import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db/http"
import {
  buildPublicPreviewCdnUrl,
  parsePublicPreviewCdnConfig,
  type PublicPreviewCdnConfig,
} from "../media/public-preview-cdn-url"
import { buildPublicStablePreviewPath } from "../media/stable-preview-path"
import {
  CARD_LIGHT_PREVIEW_PROFILE,
  DETAIL_PREVIEW_PROFILE,
  THUMB_LIGHT_PREVIEW_PROFILE,
} from "../media/watermark"
import {
  buildTypesenseRequestHeaders,
  parseTypesensePublicSearchConfig,
  TypesenseNotConfiguredError,
} from "./typesense-public-assets"

const POST_PUBLISH_SYNC_ATTEMPTS = 3
const POST_PUBLISH_SYNC_BASE_DELAY_MS = 500
const EVENT_SYNC_UPSERT_CHUNK_SIZE = 100

export class TypesenseSyncEligibilityPendingError extends Error {
  constructor(public readonly assetId: string) {
    super(`Typesense sync eligibility row is not visible yet for asset ${assetId}.`)
    this.name = "TypesenseSyncEligibilityPendingError"
  }
}

export interface TypesensePublicAssetRow {
  id: string
  fotokey: string | null
  who_is_in_picture: string | null
  headline: string | null
  caption: string | null
  description: string | null
  search_text: string | null
  keywords: unknown
  event_keywords: unknown
  image_date: Date | string | null
  created_at: Date | string | null
  updated_at: Date | string | null
  status: string
  visibility: string
  source: string
  media_type: string
  event_id: string | null
  event_title: string | null
  event_date: Date | string | null
  event_location: string | null
  category_id: string | null
  category_name: string | null
  contributor_id: string | null
  contributor_display_name: string | null
  thumb_storage_key: string | null
  thumb_width: number | null
  thumb_height: number | null
  card_storage_key: string | null
  card_width: number | null
  card_height: number | null
  detail_storage_key: string | null
  detail_width: number | null
  detail_height: number | null
}

export type TypesensePublicAssetDocument = Record<string, string | number | string[] | null>

export interface TypesenseSyncConfig {
  host: string
  apiKey: string
  collection: string
  cloudflareAccess: {
    clientId: string
    clientSecret: string
  } | null
}

export interface TypesenseCollectionField {
  name: string
  type: string
  facet?: boolean
  optional?: boolean
  sort?: boolean
}

export interface TypesenseCollectionSchema {
  name: string
  fields: TypesenseCollectionField[]
  default_sorting_field?: string
}

export interface ScheduleTypesenseSyncOptions {
  critical?: boolean
  cdn?: PublicPreviewCdnConfig
}

export interface SyncTypesensePublicAssetResult {
  assetId: string
  action: "upserted" | "deleted" | "skipped"
}

export interface SyncTypesensePublicAssetsForEventResult {
  eventId: string
  upsertedCount: number
  deletedCount: number
  action: "synced" | "skipped"
}

export function parseTypesenseSyncConfig(env: Env): TypesenseSyncConfig | null {
  try {
    const config = parseTypesensePublicSearchConfig(env)
    return {
      host: config.host,
      apiKey: config.apiKey,
      collection: config.collection,
      cloudflareAccess: config.cloudflareAccess,
    }
  } catch (error) {
    if (error instanceof TypesenseNotConfiguredError) return null
    throw error
  }
}

export function buildTypesensePublicAssetDocument(
  row: TypesensePublicAssetRow,
  cdn: PublicPreviewCdnConfig = { baseUrl: null, version: null },
): TypesensePublicAssetDocument {
  const keywords = normalizeStringList(row.keywords)
  const eventKeywords = normalizeStringList(row.event_keywords)
  const people = parsePeople(row.who_is_in_picture)

  return dropUndefined({
    id: row.id,
    asset_id: row.id,
    fotokey: row.fotokey,
    event_title: row.event_title,
    caption: row.caption,
    description: row.description,
    who_is_in_picture: row.who_is_in_picture,
    search_text: row.search_text,
    keywords,
    event_keywords: eventKeywords,
    people,
    event_id: row.event_id,
    event_date_ts: toUnixSeconds(row.event_date),
    event_location: row.event_location,
    city: row.event_location,
    category_id: row.category_id,
    category_name: row.category_name,
    contributor_id: row.contributor_id,
    contributor_display_name: row.contributor_display_name,
    status: row.status,
    visibility: row.visibility,
    source: row.source,
    media_type: row.media_type,
    image_date_ts: toUnixSeconds(row.image_date),
    created_at_ts: toUnixSeconds(row.created_at),
    updated_at_ts: toUnixSeconds(row.updated_at),
    preview_thumb_url: previewUrl(cdn, row.id, row.thumb_storage_key, "thumb"),
    preview_card_url: previewUrl(cdn, row.id, row.card_storage_key, "card"),
    preview_detail_url: previewUrl(cdn, row.id, row.detail_storage_key, "detail"),
    preview_thumb_storage_key: row.thumb_storage_key,
    preview_card_storage_key: row.card_storage_key,
    preview_detail_storage_key: row.detail_storage_key,
    preview_thumb_width: row.thumb_width,
    preview_thumb_height: row.thumb_height,
    preview_card_width: row.card_width,
    preview_card_height: row.card_height,
    preview_detail_width: row.detail_width,
    preview_detail_height: row.detail_height,
    title: titleFor(row),
    headline: row.headline,
  })
}

export function buildPublicAssetsCollectionSchema(collectionName: string): TypesenseCollectionSchema {
  return {
    name: collectionName,
    fields: [
      { name: "id", type: "string" },
      { name: "asset_id", type: "string", facet: true },
      { name: "fotokey", type: "string", optional: true },
      { name: "event_title", type: "string", facet: true, optional: true },
      { name: "caption", type: "string", optional: true },
      { name: "who_is_in_picture", type: "string", optional: true },
      { name: "people", type: "string[]", facet: true, optional: true },
      { name: "keywords", type: "string[]", facet: true, optional: true },
      { name: "category_name", type: "string", facet: true, optional: true },
      { name: "event_keywords", type: "string[]", optional: true },
      { name: "event_id", type: "string", facet: true, optional: true },
      { name: "event_date_ts", type: "int64", optional: true, sort: true },
      { name: "event_location", type: "string", optional: true },
      { name: "city", type: "string", facet: true, optional: true },
      { name: "category_id", type: "string", facet: true, optional: true },
      { name: "contributor_id", type: "string", facet: true, optional: true },
      { name: "contributor_display_name", type: "string", optional: true },
      { name: "status", type: "string", facet: true },
      { name: "visibility", type: "string", facet: true },
      { name: "source", type: "string", facet: true },
      { name: "media_type", type: "string", facet: true },
      { name: "image_date_ts", type: "int64", facet: true, optional: true, sort: true },
      { name: "created_at_ts", type: "int64", sort: true },
      { name: "updated_at_ts", type: "int64", optional: true, sort: true },
      { name: "published_at_ts", type: "int64", optional: true, sort: true },
      { name: "rank_score", type: "float", optional: true, sort: true },
    ],
    default_sorting_field: "created_at_ts",
  }
}

export function buildTypesenseDeleteByEventFilter(eventId: string): string {
  return `event_id:=${quoteTypesenseFilterValue(eventId)}`
}

export function buildTypesenseDeleteDocumentsByEventUrl(
  config: Pick<TypesenseSyncConfig, "host" | "collection">,
  eventId: string,
): URL {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents`,
    `${normalizeTypesenseHost(config.host)}/`,
  )
  url.searchParams.set("filter_by", buildTypesenseDeleteByEventFilter(eventId))
  return url
}

export async function loadTypesensePublicAssetRow(
  db: DrizzleClient,
  assetId: string,
): Promise<TypesensePublicAssetRow | null> {
  const rows = await executeRows<TypesensePublicAssetRow>(
    db,
    sql`${typesenseEligibleAssetSelectSql()} and a.id = ${assetId}::uuid limit 1`,
  )
  return rows[0] ?? null
}

export async function loadTypesensePublicAssetRowsForEvent(
  db: DrizzleClient,
  eventId: string,
): Promise<TypesensePublicAssetRow[]> {
  return executeRows<TypesensePublicAssetRow>(
    db,
    sql`${typesenseEligibleAssetSelectSql()} and a.event_id = ${eventId}::uuid order by a.id asc`,
  )
}

export async function countTypesenseEligiblePublicAssetsForEvent(
  db: DrizzleClient,
  eventId: string,
): Promise<number> {
  const rows = await executeRows<{ count: string }>(
    db,
    sql`
      select count(*)::text as count
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = ${CARD_LIGHT_PREVIEW_PROFILE}
      where a.event_id = ${eventId}::uuid
        and a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
    `,
  )
  return Number.parseInt(rows[0]?.count ?? "0", 10)
}

export async function loadTypesensePublicAssetIdsForEvent(
  db: DrizzleClient,
  eventId: string,
): Promise<string[]> {
  const rows = await executeRows<{ id: string }>(
    db,
    sql`select id::text as id from image_assets where event_id = ${eventId}::uuid order by id asc`,
  )
  return rows.map((row) => row.id)
}

export async function selectTypesensePublicAssetIndexerBatch(
  pool: pg.Pool,
  resumeAfterId: string | null,
  limit: number,
): Promise<TypesensePublicAssetRow[]> {
  const result = await pool.query<TypesensePublicAssetRow>(
    `
      select
        a.id::text,
        a.fotokey,
        a.who_is_in_picture,
        a.headline,
        a.caption,
        a.description,
        a.search_text,
        a.keywords,
        a.event_keywords,
        a.image_date,
        a.created_at,
        a.updated_at,
        a.status,
        a.visibility,
        a.source,
        a.media_type,
        e.id::text as event_id,
        e.name as event_title,
        e.event_date,
        e.location as event_location,
        coalesce(ac.id, ec.id)::text as category_id,
        coalesce(ac.name, ec.name) as category_name,
        c.id::text as contributor_id,
        c.display_name as contributor_display_name,
        thumb.storage_key as thumb_storage_key,
        thumb.width as thumb_width,
        thumb.height as thumb_height,
        card.storage_key as card_storage_key,
        card.width as card_width,
        card.height as card_height,
        detail.storage_key as detail_storage_key,
        detail.width as detail_width,
        detail.height as detail_height
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      left join image_derivatives thumb
        on thumb.image_asset_id = a.id
       and thumb.variant = 'THUMB'
       and thumb.generation_status = 'READY'
       and thumb.is_watermarked = true
       and thumb.watermark_profile = $2
      left join image_derivatives detail
        on detail.image_asset_id = a.id
       and detail.variant = 'DETAIL'
       and detail.generation_status = 'READY'
       and detail.is_watermarked = true
       and detail.watermark_profile = $3
      left join photo_events e on e.id = a.event_id
      left join asset_categories ac on ac.id = a.category_id
      left join asset_categories ec on ec.id = e.category_id
      left join contributors c on c.id = a.contributor_id
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
        and ($4::uuid is null or a.id > $4::uuid)
      order by a.id asc
      limit $5
    `,
    [CARD_LIGHT_PREVIEW_PROFILE, THUMB_LIGHT_PREVIEW_PROFILE, DETAIL_PREVIEW_PROFILE, resumeAfterId, limit],
  )
  return result.rows
}

export async function countTypesensePublicAssetIndexerCandidates(pool: pg.Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from image_assets a
      join image_derivatives card
        on card.image_asset_id = a.id
       and card.variant = 'CARD'
       and card.generation_status = 'READY'
       and card.is_watermarked = true
       and card.watermark_profile = $1
      where a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
    `,
    [CARD_LIGHT_PREVIEW_PROFILE],
  )
  return Number.parseInt(result.rows[0]?.count ?? "0", 10)
}

export async function ensureTypesensePublicAssetsCollection(config: TypesenseSyncConfig): Promise<void> {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}`,
    `${normalizeTypesenseHost(config.host)}/`,
  )
  const response = await fetch(url, {
    method: "GET",
    headers: buildTypesenseRequestHeaders(config),
  })

  if (response.ok) return

  if (response.status !== 404) {
    const body = await response.text()
    throw new Error(`Typesense collection lookup failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }

  const createUrl = new URL("/collections", `${normalizeTypesenseHost(config.host)}/`)
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      ...buildTypesenseRequestHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildPublicAssetsCollectionSchema(config.collection)),
  })

  const body = await createResponse.text()
  if (!createResponse.ok) {
    throw new Error(`Typesense collection create failed with HTTP ${createResponse.status}: ${body.slice(0, 500)}`)
  }
}

export async function upsertTypesensePublicAssetDocuments(
  config: TypesenseSyncConfig,
  documents: TypesensePublicAssetDocument[],
): Promise<void> {
  if (documents.length === 0) return

  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/import`,
    `${normalizeTypesenseHost(config.host)}/`,
  )
  url.searchParams.set("action", "upsert")
  url.searchParams.set("dirty_values", "coerce_or_reject")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...buildTypesenseRequestHeaders(config),
      "Content-Type": "text/plain",
    },
    body: documents.map((document) => JSON.stringify(document)).join("\n"),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Typesense import failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }

  const failures = parseTypesenseImportFailures(body)
  if (failures.length > 0) {
    throw new Error(`Typesense import returned row failures: ${failures.slice(0, 3).join("; ")}`)
  }
}

export async function deleteTypesensePublicAssetById(
  config: TypesenseSyncConfig,
  assetId: string,
): Promise<void> {
  const url = new URL(
    `/collections/${encodeURIComponent(config.collection)}/documents/${encodeURIComponent(assetId)}`,
    `${normalizeTypesenseHost(config.host)}/`,
  )
  const response = await fetch(url, {
    method: "DELETE",
    headers: buildTypesenseRequestHeaders(config),
  })

  if (response.status === 404) return

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Typesense delete failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }
}

export async function deleteTypesensePublicAssetsByEventId(
  config: TypesenseSyncConfig,
  eventId: string,
): Promise<void> {
  const url = buildTypesenseDeleteDocumentsByEventUrl(config, eventId)
  const response = await fetch(url, {
    method: "DELETE",
    headers: buildTypesenseRequestHeaders(config),
  })

  if (response.status === 404) return

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Typesense delete-by-event failed with HTTP ${response.status}: ${body.slice(0, 500)}`)
  }
}

export function parseTypesenseImportFailures(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { success?: boolean; error?: string; document?: { id?: string } }
        if (parsed.success === false) {
          const id = parsed.document?.id ? `id=${parsed.document.id} ` : ""
          return [`${id}${parsed.error ?? "Unknown Typesense row failure"}`]
        }
      } catch {
        return [`Unparseable Typesense import response line: ${line.slice(0, 300)}`]
      }
      return []
    })
}

export async function syncTypesensePublicAsset(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  options?: ScheduleTypesenseSyncOptions,
): Promise<SyncTypesensePublicAssetResult> {
  const config = parseTypesenseSyncConfig(env)
  if (!config) {
    console.info(JSON.stringify({ event: "typesense_sync_skipped_not_configured", assetId }))
    return { assetId, action: "skipped" }
  }

  const cdn = options?.cdn ?? parsePublicPreviewCdnConfig(env)
  const row = await loadTypesensePublicAssetRow(db, assetId)
  if (row) {
    await upsertTypesensePublicAssetDocuments(config, [buildTypesensePublicAssetDocument(row, cdn)])
    console.info(JSON.stringify({ event: "typesense_public_asset_sync", assetId, action: "upserted", status: "ok" }))
    return { assetId, action: "upserted" }
  }

  if (options?.critical && (await isPublicAssetPendingTypesenseIndex(db, assetId))) {
    throw new TypesenseSyncEligibilityPendingError(assetId)
  }

  await deleteTypesensePublicAssetById(config, assetId)
  console.info(JSON.stringify({ event: "typesense_public_asset_sync", assetId, action: "deleted", status: "ok" }))
  return { assetId, action: "deleted" }
}

export async function syncTypesensePublicAssetsForEvent(
  db: DrizzleClient,
  env: Env,
  eventId: string,
  options?: ScheduleTypesenseSyncOptions,
): Promise<SyncTypesensePublicAssetsForEventResult> {
  const config = parseTypesenseSyncConfig(env)
  if (!config) {
    console.info(JSON.stringify({ event: "typesense_sync_skipped_not_configured", eventId }))
    return { eventId, upsertedCount: 0, deletedCount: 0, action: "skipped" }
  }

  const cdn = options?.cdn ?? parsePublicPreviewCdnConfig(env)
  const eligibleRows = await loadTypesensePublicAssetRowsForEvent(db, eventId)
  const allAssetIds = await loadTypesensePublicAssetIdsForEvent(db, eventId)
  const eligibleIds = new Set(eligibleRows.map((row) => row.id))

  let upsertedCount = 0
  for (let index = 0; index < eligibleRows.length; index += EVENT_SYNC_UPSERT_CHUNK_SIZE) {
    const chunk = eligibleRows.slice(index, index + EVENT_SYNC_UPSERT_CHUNK_SIZE)
    const documents = chunk.map((row) => buildTypesensePublicAssetDocument(row, cdn))
    await upsertTypesensePublicAssetDocuments(config, documents)
    upsertedCount += documents.length
  }

  let deletedCount = 0
  for (const assetId of allAssetIds) {
    if (eligibleIds.has(assetId)) continue
    await deleteTypesensePublicAssetById(config, assetId)
    deletedCount += 1
  }

  console.info(
    JSON.stringify({
      event: "typesense_public_asset_sync",
      eventId,
      action: "synced",
      upsertedCount,
      deletedCount,
      status: "ok",
    }),
  )
  return { eventId, upsertedCount, deletedCount, action: "synced" }
}

export async function deleteTypesensePublicAssetsForEvent(env: Env, eventId: string): Promise<void> {
  const config = parseTypesenseSyncConfig(env)
  if (!config) {
    console.info(JSON.stringify({ event: "typesense_sync_skipped_not_configured", eventId, operation: "delete_event" }))
    return
  }

  await deleteTypesensePublicAssetsByEventId(config, eventId)
  console.info(JSON.stringify({ event: "typesense_public_asset_sync", eventId, action: "deleted_event", status: "ok" }))
}

export async function scheduleTypesenseSyncForAsset(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  previousEventId?: string | null,
  options?: ScheduleTypesenseSyncOptions,
): Promise<void> {
  const critical = Boolean(options?.critical)
  await runTypesenseAssetSyncWithRetries(db, env, assetId, critical, options)

  if (!previousEventId) return
  const rows = await executeRows<{ event_id: string | null }>(
    db,
    sql`select event_id::text as event_id from image_assets where id = ${assetId}::uuid limit 1`,
  )
  const currentEventId = rows[0]?.event_id ?? null
  if (previousEventId === currentEventId) return

  const eventIds = [previousEventId]
  if (currentEventId) eventIds.push(currentEventId)
  await Promise.all(
    eventIds.map((eventId) => runTypesenseEventSyncWithRetries(db, env, eventId, critical, options)),
  )
}

export async function scheduleTypesenseSyncForEvent(
  db: DrizzleClient,
  env: Env,
  eventId: string | null | undefined,
  options?: ScheduleTypesenseSyncOptions,
): Promise<void> {
  if (!eventId) return
  await runTypesenseEventSyncWithRetries(db, env, eventId, Boolean(options?.critical), options)
}

export async function scheduleTypesenseDeleteForEvent(
  env: Env,
  eventId: string,
  options?: ScheduleTypesenseSyncOptions,
): Promise<void> {
  const critical = Boolean(options?.critical)
  const maxAttempts = critical ? POST_PUBLISH_SYNC_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await deleteTypesensePublicAssetsForEvent(env, eventId)
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        JSON.stringify({
          event: "typesense_delete_event",
          eventId,
          status: "error",
          attempt,
          maxAttempts,
          errorMessage: message,
        }),
      )
      if (attempt < maxAttempts) await sleep(POST_PUBLISH_SYNC_BASE_DELAY_MS * attempt)
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  console.error(
    JSON.stringify({
      event: "typesense_delete_event_failed",
      eventId,
      errorMessage: message,
    }),
  )
}

function typesenseEligibleAssetSelectSql(): SQL {
  return sql`
    select
      a.id::text,
      a.fotokey,
      a.who_is_in_picture,
      a.headline,
      a.caption,
      a.description,
      a.search_text,
      a.keywords,
      a.event_keywords,
      a.image_date,
      a.created_at,
      a.updated_at,
      a.status,
      a.visibility,
      a.source,
      a.media_type,
      e.id::text as event_id,
      e.name as event_title,
      e.event_date,
      e.location as event_location,
      coalesce(ac.id, ec.id)::text as category_id,
      coalesce(ac.name, ec.name) as category_name,
      c.id::text as contributor_id,
      c.display_name as contributor_display_name,
      thumb.storage_key as thumb_storage_key,
      thumb.width as thumb_width,
      thumb.height as thumb_height,
      card.storage_key as card_storage_key,
      card.width as card_width,
      card.height as card_height,
      detail.storage_key as detail_storage_key,
      detail.width as detail_width,
      detail.height as detail_height
    from image_assets a
    join image_derivatives card
      on card.image_asset_id = a.id
     and card.variant = 'CARD'
     and card.generation_status = 'READY'
     and card.is_watermarked = true
     and card.watermark_profile = ${CARD_LIGHT_PREVIEW_PROFILE}
    left join image_derivatives thumb
      on thumb.image_asset_id = a.id
     and thumb.variant = 'THUMB'
     and thumb.generation_status = 'READY'
     and thumb.is_watermarked = true
     and thumb.watermark_profile = ${THUMB_LIGHT_PREVIEW_PROFILE}
    left join image_derivatives detail
      on detail.image_asset_id = a.id
     and detail.variant = 'DETAIL'
     and detail.generation_status = 'READY'
     and detail.is_watermarked = true
     and detail.watermark_profile = ${DETAIL_PREVIEW_PROFILE}
    left join photo_events e on e.id = a.event_id
    left join asset_categories ac on ac.id = a.category_id
    left join asset_categories ec on ec.id = e.category_id
    left join contributors c on c.id = a.contributor_id
    where a.status = 'ACTIVE'
      and a.visibility = 'PUBLIC'
      and a.media_type = 'IMAGE'
      and a.original_exists_in_storage = true
  `
}

async function runTypesenseAssetSyncWithRetries(
  db: DrizzleClient,
  env: Env,
  assetId: string,
  critical: boolean,
  options?: ScheduleTypesenseSyncOptions,
): Promise<void> {
  const maxAttempts = critical ? POST_PUBLISH_SYNC_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await syncTypesensePublicAsset(db, env, assetId, options)
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        JSON.stringify({
          event: "typesense_public_asset_sync",
          assetId,
          status: "error",
          attempt,
          maxAttempts,
          errorMessage: message,
        }),
      )
      if (attempt < maxAttempts) await sleep(POST_PUBLISH_SYNC_BASE_DELAY_MS * attempt)
    }
  }

  if (critical) {
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    console.error(
      JSON.stringify({
        event: "typesense_sync_post_publish_exhausted",
        assetId,
        errorMessage: message,
      }),
    )
  }
}

async function runTypesenseEventSyncWithRetries(
  db: DrizzleClient,
  env: Env,
  eventId: string,
  critical: boolean,
  options?: ScheduleTypesenseSyncOptions,
): Promise<void> {
  const maxAttempts = critical ? POST_PUBLISH_SYNC_ATTEMPTS : 1
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await syncTypesensePublicAssetsForEvent(db, env, eventId, options)
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        JSON.stringify({
          event: "typesense_public_asset_sync",
          eventId,
          status: "error",
          attempt,
          maxAttempts,
          errorMessage: message,
        }),
      )
      if (attempt < maxAttempts) await sleep(POST_PUBLISH_SYNC_BASE_DELAY_MS * attempt)
    }
  }

  if (critical) {
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    console.error(
      JSON.stringify({
        event: "typesense_sync_post_publish_exhausted",
        eventId,
        errorMessage: message,
      }),
    )
  }
}

async function isPublicAssetPendingTypesenseIndex(db: DrizzleClient, assetId: string): Promise<boolean> {
  const rows = await executeRows<{ id: string }>(
    db,
    sql`
      select a.id::text as id
      from image_assets a
      where a.id = ${assetId}::uuid
        and a.status = 'ACTIVE'
        and a.visibility = 'PUBLIC'
        and a.media_type = 'IMAGE'
        and a.original_exists_in_storage = true
      limit 1
    `,
  )
  return rows.length > 0
}

async function executeRows<T>(db: DrizzleClient, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as T[]
  }
  return []
}

function previewUrl(
  cdn: PublicPreviewCdnConfig,
  assetId: string,
  storageKey: string | null,
  variant: "thumb" | "card" | "detail",
): string | null {
  if (!storageKey && variant === "detail") return null
  const cdnUrl = storageKey
    ? buildPublicPreviewCdnUrl({
        baseUrl: cdn.baseUrl ?? "",
        version: cdn.version,
        storageKey,
        variant,
      })
    : null
  return cdnUrl ?? buildPublicStablePreviewPath(assetId, variant)
}

function titleFor(row: TypesensePublicAssetRow): string {
  const candidates = [
    row.headline,
    row.who_is_in_picture,
    row.event_title,
    snippet(row.caption, 120),
    row.fotokey,
    row.id,
  ]
  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)!.trim()
}

function parsePeople(value: string | null): string[] {
  const normalized = value?.trim()
  if (!normalized) return []
  const parts = normalized
    .split(/[,;|\n\r]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return [normalized]
  if (parts.join(" ").length < Math.max(1, Math.floor(normalized.length / 2))) return [normalized]
  return unique(parts)
}

function normalizeStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return unique(value.flatMap((item) => normalizeStringList(item)))
  if (typeof value === "object") return normalizeStringList(Object.values(value))

  const raw = String(value).trim()
  if (!raw) return []

  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return normalizeStringList(JSON.parse(raw))
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return unique(
    raw
      .split(/[,;|\n\r]+/g)
      .map((part) => part.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function toUnixSeconds(value: Date | string | null): number | null {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 1000)
}

function snippet(value: string | null, max: number): string | null {
  const normalized = value?.trim()
  if (!normalized) return null
  return normalized.length <= max ? normalized : normalized.slice(0, max).trim()
}

function dropUndefined(input: Record<string, unknown>): TypesensePublicAssetDocument {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as TypesensePublicAssetDocument
}

function quoteTypesenseFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/`/g, "\\`")
  return `\`${escaped}\``
}

function normalizeTypesenseHost(host: string): string {
  return host.trim().replace(/\/+$/, "").replace(/\/collections\/?$/, "")
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
